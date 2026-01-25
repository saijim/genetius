import { db, papers, and, gte, sql } from 'astro:db';
import {
  getDateInterval,
  isTrendError,
  type TrendResult,
  type TrendError,
  type KeywordCount,
  type TypeCount,
} from '~/lib/trends-types';

export type { KeywordCount, TypeCount, TrendResult, TrendError };

export { getDateInterval, isTrendError };

export async function getTrends(
  period: 'day' | 'week' | 'month' | 'year'
): Promise<TrendResult | TrendError> {
  try {
    const interval = getDateInterval(period);
    const [keywords, paperTypes] = await Promise.all([
      getKeywordTrends(interval.start, interval.end),
      getTypeTrends(interval.start, interval.end),
    ]);

    return {
      period,
      keywords,
      paperTypes,
    };
  } catch (error) {
    console.error('Failed to fetch trends:', error);
    return {
      error: 'Failed to fetch trends',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAllTrends(): Promise<Record<string, TrendResult>> {
  const periods: Array<'day' | 'week' | 'month' | 'year'> = [
    'day',
    'week',
    'month',
    'year',
  ];

  const results = await Promise.allSettled(
    periods.map((period) => getTrends(period))
  );

  const trends: Record<string, TrendResult> = {};

  for (const [index, result] of results.entries()) {
    const period = periods[index];

    if (result.status === 'fulfilled' && !isTrendError(result.value)) {
      trends[period] = result.value;
    } else {
      console.error(`Failed to fetch trends for ${period}:`, result);
    }
  }

  return trends;
}

async function getKeywordTrends(
  startDate: Date,
  endDate: Date
): Promise<KeywordCount[]> {
  try {
    const result = await db
      .select({
        keyword: sql<string>`json_extract(${papers.keywords}, '$')`,
        count: sql<number>`count(*)`,
      })
      .from(papers)
      .where(and(gte(papers.date, startDate), sql`${papers.date} <= ${endDate}`))
      .groupBy(sql`json_extract(${papers.keywords}, '$')`)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return result as unknown as KeywordCount[];
  } catch (error) {
    console.error('Failed to fetch keyword trends:', error);
    return [];
  }
}

async function getTypeTrends(
  startDate: Date,
  endDate: Date
): Promise<TypeCount[]> {
  try {
    const result = await db
      .select({
        type: papers.type,
        count: sql<number>`count(*)`,
      })
      .from(papers)
      .where(and(gte(papers.date, startDate), sql`${papers.date} <= ${endDate}`))
      .groupBy(papers.type)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return result as unknown as TypeCount[];
  } catch (error) {
    console.error('Failed to fetch type trends:', error);
    return [];
  }
}
