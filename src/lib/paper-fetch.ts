import { db, papers, refreshLogs, desc, eq } from 'astro:db';
import {
  fetchPapers,
  type BiorxivPaper,
  isBiorxivError,
} from '~/lib/biorxiv';
import {
  generateSummaryAndKeywords,
  isOpenRouterError,
} from '~/lib/openrouter';
import { toMarkdown, type PaperData } from '~/lib/markdown';

export interface FetchResult {
  fetched: number;
  processed: number;
  errors: number;
  intervalStart: Date;
  intervalEnd: Date;
}

export async function fetchPapersOrchestration(): Promise<FetchResult | Error> {
  try {
    const now = new Date();
    const intervalEnd = new Date();
    const intervalStart = await calculateIntervalStart(now);

    const existingDois = await getExistingDois();
    const existingDoiSet = new Set(existingDois);

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

        const newPapers = result.papers.filter(
          (paper) => !existingDoiSet.has(paper.doi)
        );

        fetched += result.papers.length;

        for (const paper of newPapers) {
          try {
            const summaryResult = await generateSummaryAndKeywords(paper.abstract);

            if (isOpenRouterError(summaryResult)) {
              console.error(`Failed to generate summary for ${paper.doi}:`, summaryResult.error);
              errors++;
              continue;
            }

            const { summary, keywords } = summaryResult;
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
              markdown,
            });

            processed++;
            existingDoiSet.add(paper.doi);

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

async function getExistingDois(): Promise<string[]> {
  const result = await db.select({ doi: papers.doi }).from(papers);
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
