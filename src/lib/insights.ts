import { db, papers, gte, sql } from 'astro:db';

export interface TopicMomentum {
  keyword: string;
  recentCount: number;
  previousCount: number;
  momentum: number;
}

export interface AuthorNetwork {
  author1: string;
  author2: string;
  weight: number;
}

export interface MethodTrend {
  method: string;
  count: number;
}

export interface KeywordCooccurrence {
  keyword1: string;
  keyword2: string;
  count: number;
}

export interface InsightsData {
  momentum: TopicMomentum[];
  network: AuthorNetwork[];
  methods: MethodTrend[];
  clusters: KeywordCooccurrence[];
}

// In-memory cache for insights
let insightsCache: InsightsData | null = null;
let lastInsightsCacheTime = 0;
const INSIGHTS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function clearInsightsCache() {
  insightsCache = null;
  lastInsightsCacheTime = 0;
  console.log('[Insights] Cache cleared');
}

export async function getInsights(): Promise<InsightsData> {
  const now = Date.now();
  if (insightsCache && (now - lastInsightsCacheTime < INSIGHTS_CACHE_TTL)) {
    console.log('[Insights] Returning cached data');
    return insightsCache;
  }

  console.log('[Insights] Cache miss, fetching fresh data');
  const [momentum, network, methods, clusters] = await Promise.all([
    getTopicMomentum(),
    getAuthorNetwork(),
    getMethodTrends(),
    getKeywordCooccurrence(),
  ]);

  insightsCache = { momentum, network, methods, clusters };
  lastInsightsCacheTime = now;
  return insightsCache;
}



export async function getTopicMomentum(): Promise<TopicMomentum[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(now.getMonth() - 6);

  try {
    // Use SQL aggregation for both time periods in parallel
    // This dramatically reduces reads by doing aggregation in the DB
    const recentQuery = sql`
      SELECT "value" as keyword, count(*) as count
      FROM ${papers}, json_each(${papers.keywords})
      WHERE ${papers.date} >= ${thirtyDaysAgo.toISOString()}
      GROUP BY "value"
      ORDER BY count DESC
      LIMIT 50
    `;

    const previousQuery = sql`
      SELECT "value" as keyword, count(*) as count
      FROM ${papers}, json_each(${papers.keywords})
      WHERE ${papers.date} >= ${sixMonthsAgo.toISOString()}
        AND ${papers.date} < ${thirtyDaysAgo.toISOString()}
      GROUP BY "value"
      ORDER BY count DESC
      LIMIT 50
    `;

    const [recentResult, previousResult] = await Promise.all([
      db.run(recentQuery),
      db.run(previousQuery)
    ]);

    // Create maps from query results
    const recentCounts = new Map<string, number>();
    for (const row of recentResult.rows) {
      const keyword = String(row.keyword || row.value);
      recentCounts.set(keyword, Number(row.count));
    }

    const previousCounts = new Map<string, number>();
    for (const row of previousResult.rows) {
      const keyword = String(row.keyword || row.value);
      previousCounts.set(keyword, Number(row.count));
    }

    // Calculate momentum
    const momentum: TopicMomentum[] = [];

    for (const [keyword, recent] of recentCounts.entries()) {
      if (recent < 2) continue; // Filter noise

      const previous = previousCounts.get(keyword) || 0;
      // Normalize: recent is 1 month, previous is 5 months
      const normalizedPrevious = previous / 5;

      const score = normalizedPrevious === 0 ? recent : (recent - normalizedPrevious) / normalizedPrevious;

      momentum.push({
        keyword,
        recentCount: recent,
        previousCount: previous,
        momentum: score
      });
    }

    return momentum.sort((a, b) => b.momentum - a.momentum).slice(0, 10);
  } catch (error) {
    console.error('Failed to fetch topic momentum:', error);
    return [];
  }
}

export async function getKeywordCooccurrence(): Promise<KeywordCooccurrence[]> {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(now.getMonth() - 3);

  // Only look at the most recent papers - limit to 100 to reduce reads
  const recentPapers = await db
    .select({ keywords: papers.keywords })
    .from(papers)
    .where(gte(papers.date, threeMonthsAgo))
    .orderBy(sql`${papers.date} DESC`)
    .limit(100);

  const pairs = new Map<string, number>();

  for (const paper of recentPapers) {
    const keywords = (paper.keywords as string[] || []).sort();

    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const k1 = keywords[i];
        const k2 = keywords[j];
        if (k1 === k2) continue;

        const key = `${k1}|${k2}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  const result: KeywordCooccurrence[] = [];
  for (const [key, count] of pairs.entries()) {
    if (count < 2) continue;
    const [k1, k2] = key.split('|');
    result.push({ keyword1: k1, keyword2: k2, count });
  }

  return result.sort((a, b) => b.count - a.count).slice(0, 15);
}

export async function getAuthorNetwork(): Promise<AuthorNetwork[]> {
  // Only look at the most recent papers - limit to 50 to reduce reads
  const recentPapers = await db
    .select({ authors: papers.authors })
    .from(papers)
    .orderBy(sql`${papers.date} DESC`)
    .limit(50);

  const pairs = new Map<string, number>();

  for (const paper of recentPapers) {
    const authors = (paper.authors as string[] || []).slice(0, 5).sort(); // Take first 5 authors to avoid massive combinatorics on huge papers

    for (let i = 0; i < authors.length; i++) {
      for (let j = i + 1; j < authors.length; j++) {
        const a1 = authors[i];
        const a2 = authors[j];

        const key = `${a1}|${a2}`;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    }
  }

  const result: AuthorNetwork[] = [];
  for (const [key, weight] of pairs.entries()) {
    if (weight < 2) continue;
    const [a1, a2] = key.split('|');
    result.push({ author1: a1, author2: a2, weight });
  }

  return result.sort((a, b) => b.weight - a.weight).slice(0, 10);
}

export async function getMethodTrends(): Promise<MethodTrend[]> {
  // Only look at the most recent papers - limit to 100 to reduce reads
  const recentPapers = await db
    .select({ methods: papers.methods })
    .from(papers)
    .orderBy(sql`${papers.date} DESC`)
    .limit(100);

  const counts = new Map<string, number>();

  for (const paper of recentPapers) {
    const methods = paper.methods as string[] || [];
    for (const method of methods) {
      if (!method) continue;
      counts.set(method, (counts.get(method) || 0) + 1);
    }
  }

  const result: MethodTrend[] = [];
  for (const [method, count] of counts.entries()) {
    result.push({ method, count });
  }

  return result.sort((a, b) => b.count - a.count).slice(0, 10);
}
