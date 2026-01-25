import { db, papers, sql } from 'astro:db';
import {
  getDateInterval,
  isTrendError,
  type TrendResult,
  type TrendError,
  type KeywordCount,
  type TypeCount,
  type AuthorCount,
  type PeriodStats,
} from '~/lib/trends-types';

export type { KeywordCount, TypeCount, AuthorCount, PeriodStats, TrendResult, TrendError };
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
    const [keywords, paperTypes, authors, stats] = await Promise.all([
      getKeywordTrends(interval.start, interval.end),
      getTypeTrends(interval.start, interval.end),
      getAuthorTrends(interval.start, interval.end),
      getPeriodStats(interval.start, interval.end),
    ]);

    return {
      period,
      keywords,
      paperTypes,
      authors,
      stats,
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

async function getAuthorTrends(
  startDate: Date,
  endDate: Date
): Promise<AuthorCount[]> {
  try {
    const query = sql`
      SELECT 
        "value" as author, 
        count(*) as count 
      FROM ${papers}, json_each(${papers.authors})
      WHERE ${papers.date} >= ${startDate.toISOString()} AND ${papers.date} <= ${endDate.toISOString()}
      GROUP BY "value"
      ORDER BY count(*) DESC
      LIMIT 10
    `;

    const rawResult = await db.run(query);
    const rows = rawResult.rows;

    return rows.map((row: any) => ({
      author: String(row.author || row.value),
      count: Number(row.count),
    }));
  } catch (error) {
    console.error('Failed to fetch author trends:', error);
    return [];
  }
}

async function getPeriodStats(
  startDate: Date,
  endDate: Date
): Promise<PeriodStats> {
  try {
    // Calculate total papers
    const countQuery = sql`
      SELECT count(*) as total
      FROM ${papers}
      WHERE ${papers.date} >= ${startDate.toISOString()} AND ${papers.date} <= ${endDate.toISOString()}
    `;
    
    // Calculate average authors per paper
    // json_array_length is available in SQLite/libSQL for JSON columns
    const avgQuery = sql`
      SELECT avg(json_array_length(${papers.authors})) as avg_authors
      FROM ${papers}
      WHERE ${papers.date} >= ${startDate.toISOString()} AND ${papers.date} <= ${endDate.toISOString()}
    `;

    const [countResult, avgResult] = await Promise.all([
      db.run(countQuery),
      db.run(avgQuery)
    ]);

    const totalPapers = Number(countResult.rows[0]?.total || 0);
    const avgAuthors = Number(avgResult.rows[0]?.avg_authors || 0);

    return {
      totalPapers,
      avgAuthors: Math.round(avgAuthors * 10) / 10 // Round to 1 decimal place
    };
  } catch (error) {
    console.error('Failed to fetch period stats:', error);
    return { totalPapers: 0, avgAuthors: 0 };
  }
}

export async function getKeywordFilters(
  searchQuery?: string,
  typeFilter?: string
): Promise<KeywordCount[]> {
  try {
    // We want to count papers for each keyword, filtering by the current search/type context
    // DISTINCT papers.id is important because a keyword could theoretically appear multiple times 
    // (though not likely in our schema) but more importantly we are joining 
    // papers with json_each(keywords) so we are looking at paper-keyword pairs.
    
    // Start building the query parts
    const parts = [
      sql`SELECT "value" as keyword, count(DISTINCT ${papers.id}) as count`,
      sql`FROM ${papers}, json_each(${papers.keywords})`,
      sql`WHERE 1=1`
    ];

    // Add search filter if present
    if (searchQuery) {
      parts.push(sql`AND (
        ${papers.title} LIKE ${`%${searchQuery}%`} 
        OR 
        ${papers.summary} LIKE ${`%${searchQuery}%`}
      )`);
    }

    // Add type filter if present
    if (typeFilter) {
      parts.push(sql`AND ${papers.type} = ${typeFilter}`);
    }

    // Add grouping and ordering
    parts.push(sql`GROUP BY "value"`);
    parts.push(sql`ORDER BY count DESC`);
    parts.push(sql`LIMIT 50`);

    // Combine all parts into a single SQL query
    const query = sql.join(parts, sql` `);

    const rawResult = await db.run(query);
    const rows = rawResult.rows;

    return rows.map((row: any) => ({
      keyword: String(row.keyword || row.value),
      count: Number(row.count),
    }));
  } catch (error) {
    console.error('Failed to fetch keyword filters:', error);
    return [];
  }
}
