import { db, papers, refreshLogs, desc, eq, inArray, sql } from 'astro:db';
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

// Configuration for batch processing
const BATCH_SIZE = 10; // Number of papers to process before batch insert

export async function fetchAndProcessPapers(
): Promise<{ fetched: number; processed: number; errors: number }> {
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

interface ProcessedPaper {
  doi: string;
  title: string;
  authors: string[];
  date: Date;
  version: number;
  type: string;
  abstract: string;
  summary: string;
  keywords: string[];
  methods: string[];
  modelOrganism: string | null;
  markdown: string;
}

export async function fetchPapersOrchestration(forcedDaysBack?: number): Promise<FetchResult | Error> {
  try {
    const now = new Date();
    const intervalEnd = new Date();
    
    let intervalStart: Date;
    if (forcedDaysBack) {
       intervalStart = new Date(now);
       intervalStart.setDate(intervalStart.getDate() - forcedDaysBack);
       if (intervalStart > now) intervalStart = now;
    } else {
       intervalStart = await calculateIntervalStart(now);
    }

    let fetched = 0;
    let processed = 0;
    let errors = 0;
    let cursor = 0;

    // Collection buffer for batch insertion
    const papersBuffer: ProcessedPaper[] = [];

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

        fetched += result.papers.length;

        // Pre-check all new papers in one batch query to detect race conditions
        const newPaperDois = newPapers.map(p => p.doi);
        const raceCheckResults = newPaperDois.length > 0 
          ? await db.select({ doi: papers.doi, summary: papers.summary })
              .from(papers)
              .where(inArray(papers.doi, newPaperDois))
          : [];
        const raceCheckMap = new Map(raceCheckResults.map(r => [r.doi, r.summary]));

        for (const paper of newPapers) {
          try {
            // Check if paper was inserted by concurrent process (race condition)
            const existingSummary = raceCheckMap.get(paper.doi);
            if (existingSummary !== undefined) {
              if (existingSummary) {
                console.log(`Skipping already processed paper: ${paper.doi}`);
                continue;
              }
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

            // Add to buffer instead of immediate insert
            papersBuffer.push({
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
              modelOrganism: modelOrganism ?? null,
              markdown,
            });

            processed++;

            // Batch insert when buffer reaches threshold
            if (papersBuffer.length >= BATCH_SIZE) {
              await insertPapersBatch(papersBuffer, refreshLogId, fetched, processed);
              papersBuffer.length = 0; // Clear buffer
            }
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

      // Insert any remaining papers in buffer
      if (papersBuffer.length > 0) {
        await insertPapersBatch(papersBuffer, refreshLogId, fetched, processed);
        papersBuffer.length = 0;
      }

      // Final status update using transaction
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
      // Attempt to update status to error, but don't throw if this fails
      try {
        await updateRefreshLogStatus(refreshLogId, 'error', fetched, processed);
      } catch (statusError) {
        console.error('Failed to update refresh log status:', statusError);
      }
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
  // Use raw SQL with returning clause for atomic insert + select
  const result = await db.run(sql`
    INSERT INTO refreshLogs (intervalStart, intervalEnd, papersFetched, papersProcessed, status)
    VALUES (${intervalStart.toISOString()}, ${intervalEnd.toISOString()}, 0, 0, 'in_progress')
    RETURNING id
  `);

  if (!result.rows || result.rows.length === 0) {
    throw new Error('Failed to create refresh log');
  }

  return Number(result.rows[0].id);
}

/**
 * Batch insert papers and update refresh log transactionally
 * Uses individual awaits but with proper error handling for consistency
 */
async function insertPapersBatch(
  papersToInsert: ProcessedPaper[],
  refreshLogId: number,
  papersFetched: number,
  papersProcessed: number
): Promise<void> {
  if (papersToInsert.length === 0) return;

  try {
    // Insert all papers using batch for atomicity
    const insertQueries = papersToInsert.map(paper =>
      db.insert(papers).values({
        doi: paper.doi,
        title: paper.title,
        authors: paper.authors,
        date: paper.date,
        version: paper.version,
        type: paper.type,
        abstract: paper.abstract,
        summary: paper.summary,
        keywords: paper.keywords,
        methods: paper.methods,
        modelOrganism: paper.modelOrganism,
        markdown: paper.markdown,
      })
    );

    // Execute all inserts atomically using batch
    if (insertQueries.length > 0) {
      await db.batch(insertQueries as [typeof insertQueries[0], ...typeof insertQueries[0][]]);
    }

    // Update refresh log progress separately (best effort)
    await db
      .update(refreshLogs)
      .set({ papersFetched, papersProcessed })
      .where(eq(refreshLogs.id, refreshLogId));

    console.log(`[Paper Fetch] Batch inserted ${papersToInsert.length} papers`);
  } catch (error) {
    console.error('[Paper Fetch] Batch insert failed:', error);
    throw error;
  }
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
