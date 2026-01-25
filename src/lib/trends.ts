import { db, papers, sql } from 'astro:db';
import {
  getDateInterval,
  isTrendError,
  type TrendResult,
  type TrendError,
  type KeywordCount,
  type TypeCount,
} from '~/lib/trends-types';

export type { KeywordCount, TypeCount, TrendResult, TrendError };
export interface TrendsData {
  day?: TrendResult;
  week?: TrendResult;
  month?: TrendResult;
  year?: TrendResult;
}

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

export async function getAllTrends(): Promise<TrendsData> {
  const periods: Array<'day' | 'week' | 'month' | 'year'> = [
    'day',
    'week',
    'month',
    'year',
  ];

  const results = await Promise.allSettled(
    periods.map((period) => getTrends(period))
  );

  const trends: TrendsData = {};

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
    // We use a raw SQL query here because Drizzle's SQLite support for `json_each` 
    // or unnesting JSON arrays is tricky to type strictly with `db.select()`.
    // We need to explode the JSON array into individual rows to count them.
    
    // Note: Astro DB uses libSQL (SQLite compatible).
    // IMPORTANT: Drizzle SQL template parameters (like ${startDate}) are converted to bind parameters (?)
    // When using raw SQL with db.run(), we must handle the Date objects carefully.
    // SQLite stores dates as ISO strings usually. Drizzle handles this in .select() but in sql`` we might need to be explicit.
    
    const query = sql`
      SELECT 
        "value" as keyword, 
        count(*) as count 
      FROM ${papers}, json_each(${papers.keywords})
      WHERE ${papers.date} >= ${startDate.toISOString()} AND ${papers.date} <= ${endDate.toISOString()}
      GROUP BY "value"
      ORDER BY count(*) DESC
      LIMIT 10
    `;

    const rawResult = await db.run(query);
    const rows = rawResult.rows;

    return rows.map((row: any) => ({
      keyword: String(row.keyword || row.value), // Handle potential alias differences
      count: Number(row.count),
    }));

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
    const query = sql`
      SELECT 
        "type", 
        count(*) as count 
      FROM ${papers}
      WHERE ${papers.date} >= ${startDate.toISOString()} AND ${papers.date} <= ${endDate.toISOString()}
      GROUP BY "type"
      ORDER BY count(*) DESC
      LIMIT 10
    `;

    const rawResult = await db.run(query);
    const rows = rawResult.rows;

    return rows.map((row: any) => ({
      type: String(row.type),
      count: Number(row.count),
    }));
  } catch (error) {
    console.error('Failed to fetch type trends:', error);
    return [];
  }
}
