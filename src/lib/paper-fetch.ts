import { db, papers, refreshLogs, desc, eq, inArray } from 'astro:db';
import {
  fetchPapers,
  isBiorxivError,
} from '~/lib/biorxiv';
import {
  generateSummaryAndKeywords,
  isOpenRouterError,
} from '~/lib/openrouter';
import { toMarkdown } from '~/lib/markdown';
import { recomputeFilters } from '~/lib/filters';


export async function fetchAndProcessPapers(
): Promise<{ fetched: number; processed: number; errors: number }> {
  // This function signature was kept for compatibility but is no longer the main entry point.
  // We'll map it to the new orchestration logic, ignoring the parameters for now
  // or adapting them if we want to force a specific manual fetch.
  // For now, let's just call the new logic.
  const result = await fetchPapersOrchestration();
  if (result instanceof Error) {
    throw result;
  }
  return {
    fetched: result.fetched,
    processed: result.processed,
    errors: result.errors
  };
}

export interface FetchResult {
  fetched: number;
  processed: number;
  errors: number;
  intervalStart: Date;
  intervalEnd: Date;
}

export async function fetchPapersOrchestration(forcedDaysBack?: number): Promise<FetchResult | Error> {
  try {
    const now = new Date();
    const intervalEnd = new Date();
    
    // If forcedDaysBack is provided, calculate start date based on that.
    // Otherwise, use the smart logic to find the gap.
    let intervalStart: Date;
    if (forcedDaysBack) {
       intervalStart = new Date(now);
       intervalStart.setDate(intervalStart.getDate() - forcedDaysBack);
       // Ensure we don't go into the future
       if (intervalStart > now) intervalStart = now;
    } else {
       intervalStart = await calculateIntervalStart(now);
    }

    let fetched = 0;
    let processed = 0;
    let errors = 0;
    let cursor = 0;

    const refreshLogId = await createRefreshLog(intervalStart, intervalEnd);

    try {
      while (true) {
        const result = await fetchPapers({
          intervalStart,
          intervalEnd,
          cursor,
        });

        if (isBiorxivError(result)) {
          throw new Error(result.error);
        }

        // Get DOIs for the current batch only
        const batchDois = result.papers.map(p => p.doi);
        const existingInBatch = await getExistingDoisFromBatch(batchDois);
        const existingDoiSet = new Set(existingInBatch);

        const newPapers = result.papers.filter(
          (paper) => !existingDoiSet.has(paper.doi)
        );

        // Filter out papers that might be fully processed (though our query check above covers basic existence)
        // If "all data" means ensuring fields like summary/markdown are present, our current check relies on the fact
        // that we only insert a row once EVERYTHING is ready.
        // However, if a previous run failed halfway, we might have partial data?
        // Actually, the insert happens in one transaction-like block (await db.insert...).
        // So if a DOI exists, it should be complete.
        // But let's respect the existing check.

        fetched += result.papers.length;

        for (const paper of newPapers) {
          try {
            // Re-check for existence immediately before processing to handle race conditions
            // Also explicitly check if summary/markdown is missing if we want to support "resume partials" later,
            // but for now, if the DOI exists, we assume it's done.
            const existing = await db.select({ 
              id: papers.id, 
              summary: papers.summary 
            }).from(papers).where(eq(papers.doi, paper.doi)).limit(1);

            if (existing.length > 0) {
              const row = existing[0];
              // If it exists and has a summary, it's fully processed.
              if (row.summary) {
                console.log(`Skipping already processed paper: ${paper.doi}`);
                continue;
              }
              // If it exists but has NO summary (failed previously?), we might want to update it?
              // The current logic inserts a NEW row, which would fail unique constraint.
              // So if it exists (even incomplete), we skip it to prevent errors.
              // To support "retry incomplete", we'd need an UPDATE instead of INSERT.
              console.log(`Skipping existing paper (fully or partially processed): ${paper.doi}`);
              continue;
            }

            const summaryResult = await generateSummaryAndKeywords(paper.abstract);

            if (isOpenRouterError(summaryResult)) {
              console.error(`Failed to generate summary for ${paper.doi}:`, summaryResult.error);
              errors++;
              continue;
            }

            const { summary, keywords, methods, modelOrganism } = summaryResult;
            const markdown = toMarkdown({
              title: paper.title,
              authors: paper.authors,
              date: paper.date.toISOString(),
              version: paper.version,
              doi: paper.doi,
              category: 'plant_biology',
              abstract: paper.abstract,
              summary,
              keywords,
              methods,
            });

            await db.insert(papers).values({
              doi: paper.doi,
              title: paper.title,
              authors: paper.authors,
              date: paper.date,
              version: paper.version,
              type: paper.type,
              abstract: paper.abstract,
              summary,
              keywords,
              methods,
              modelOrganism,
              markdown,
            });

            processed++;
            // No need to add to set as we check per batch
            
            await updateRefreshLogProgress(refreshLogId, fetched, processed);
          } catch (error) {
            console.error(`Error processing paper ${paper.doi}:`, error);
            errors++;
          }
        }

        if (result.papers.length < 100 || fetched >= result.total) {
          break;
        }

        cursor += 100;
      }

      await updateRefreshLogStatus(refreshLogId, 'completed', fetched, processed);

      // Recompute filters if new papers were added
      if (processed > 0) {
        console.log('[Paper Fetch] Recomputing filters after processing new papers...');
        try {
          await recomputeFilters();
        } catch (error) {
          console.error('[Paper Fetch] Failed to recompute filters (non-fatal):', error);
        }
      }

      return { fetched, processed, errors, intervalStart, intervalEnd };
    } catch (error) {
      await updateRefreshLogStatus(refreshLogId, 'error', fetched, processed);
      throw error;
    }
  } catch (error) {
    console.error('Failed to orchestrate paper fetch:', error);
    return error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

async function calculateIntervalStart(now: Date): Promise<Date> {
  const lastRefresh = await db
    .select()
    .from(refreshLogs)
    .orderBy(desc(refreshLogs.date))
    .limit(1);

  if (lastRefresh.length === 0) {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sevenDaysAgo;
  }

  const lastLog = lastRefresh[0];
  const daysSinceLastRefresh = Math.floor(
    (now.getTime() - lastLog.date.getTime()) / (1000 * 60 * 60 * 24)
  );

  const intervalStart = new Date(now);
  const daysToFetch = Math.min(7, daysSinceLastRefresh);
  intervalStart.setDate(intervalStart.getDate() - daysToFetch);

  return intervalStart;
}

async function getExistingDoisFromBatch(dois: string[]): Promise<string[]> {
  if (dois.length === 0) return [];
  const result = await db
    .select({ doi: papers.doi })
    .from(papers)
    .where(inArray(papers.doi, dois));
  return result.map((r) => r.doi);
}

async function createRefreshLog(
  intervalStart: Date,
  intervalEnd: Date
): Promise<number> {
  await db.insert(refreshLogs).values({
    intervalStart,
    intervalEnd,
    papersFetched: 0,
    papersProcessed: 0,
    status: 'in_progress',
  });

  const newLog = await db
    .select()
    .from(refreshLogs)
    .orderBy(desc(refreshLogs.date))
    .limit(1);

  if (newLog.length === 0) {
    throw new Error('Failed to create refresh log');
  }

  return newLog[0].id;
}

async function updateRefreshLogProgress(
  id: number,
  papersFetched: number,
  papersProcessed: number
): Promise<void> {
  await db
    .update(refreshLogs)
    .set({ papersFetched, papersProcessed })
    .where(eq(refreshLogs.id, id));
}

async function updateRefreshLogStatus(
  id: number,
  status: 'completed' | 'error',
  papersFetched: number,
  papersProcessed: number
): Promise<void> {
  await db
    .update(refreshLogs)
    .set({ status, papersFetched, papersProcessed })
    .where(eq(refreshLogs.id, id));
}
