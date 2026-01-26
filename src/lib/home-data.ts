import { db, papers, desc, count, like, or, and, eq, sql } from 'astro:db';
import type { papers as PapersType } from 'astro:db';
import { getKeywordFilters, getModelOrganismFilters } from '~/lib/trends';

// Define Paper type based on the schema
export type Paper = typeof PapersType.$inferSelect;

export interface HomePageData {
  latestPapers: Paper[];
  totalPapers: number;
  paperTypes: string[];
  keywordFilters: { keyword: string; count: number }[];
  organismFilters: { organism: string; count: number }[];
}

// In-memory cache
let homePageCache: HomePageData | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function clearHomePageCache() {
  homePageCache = null;
  lastCacheTime = 0;
  console.log('[Home] Cache cleared manually');
}

export async function getHomePageData(
  page: number = 1,
  searchQuery: string = '',
  typeFilter: string = '',
  keywordsParam: string = '',
  organismParam: string = ''
): Promise<HomePageData> {
  const PAGE_SIZE = 10;
  
  // Check if this is an unfiltered, first-page request
  const isUnfiltered = page === 1 && !searchQuery && !typeFilter && !keywordsParam && !organismParam;

  // Return cached data if valid and applicable
  if (isUnfiltered && homePageCache && (Date.now() - lastCacheTime < CACHE_TTL)) {
    console.log('[Home] Returning cached data for homepage');
    return homePageCache;
  }

  // Calculate fresh data
  const selectedKeywords = keywordsParam ? keywordsParam.split(',').filter(Boolean) : [];
  const offset = (page - 1) * PAGE_SIZE;

  // Fetch available paper types for the filter dropdown
  // We fetch this every time for now, but could be cached separately if needed
  const typesResult = await db
    .select({ type: papers.type })
    .from(papers)
    .groupBy(papers.type);
  const paperTypes = typesResult.map(t => t.type).sort();

  // Fetch keyword and organism filters based on current search context
  const [keywordFilters, organismFilters] = await Promise.all([
    getKeywordFilters(searchQuery, typeFilter),
    getModelOrganismFilters(searchQuery, typeFilter)
  ]);

  // Construct where clause
  const conditions = [];
  
  if (searchQuery) {
    conditions.push(
      or(
        like(papers.title, `%${searchQuery}%`), 
        like(papers.summary, `%${searchQuery}%`)
      )
    );
  }

  if (typeFilter) {
    conditions.push(eq(papers.type, typeFilter));
  }

  if (selectedKeywords.length > 0) {
    const keywordConditions = selectedKeywords.map(k => 
      sql`EXISTS (SELECT 1 FROM json_each(${papers.keywords}) WHERE value = ${k})`
    );
    conditions.push(or(...keywordConditions));
  }

  if (organismParam) {
    conditions.push(eq(papers.modelOrganism, organismParam));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count for pagination
  const countResult = await db
    .select({ value: count() })
    .from(papers)
    .where(whereClause);
    
  const totalPapers = countResult[0].value;

  const latestPapers = await db
    .select()
    .from(papers)
    .where(whereClause)
    .orderBy(desc(papers.date))
    .limit(PAGE_SIZE)
    .offset(offset);

  const result: HomePageData = {
    latestPapers,
    totalPapers,
    paperTypes,
    keywordFilters,
    organismFilters
  };

  // Update cache only if it's the unfiltered homepage
  if (isUnfiltered) {
    homePageCache = result;
    lastCacheTime = Date.now();
    console.log('[Home] Cache updated');
  }

  return result;
}
