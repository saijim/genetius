import { db, papers, desc, count, like, or, and, eq, sql } from 'astro:db';
import type { papers as PapersType } from 'astro:db';
import { getKeywordFilters, getModelOrganismFilters } from '~/lib/filters';

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

// Global Metadata Cache (shared across pages for unfiltered views)
interface GlobalMetadata {
  paperTypes: string[];
  keywordFilters: { keyword: string; count: number }[];
  organismFilters: { organism: string; count: number }[];
  totalPapers: number;
}

let globalMetadataCache: GlobalMetadata | null = null;
let globalMetadataTime = 0;

export function clearHomePageCache() {
  homePageCache = null;
  lastCacheTime = 0;
  globalMetadataCache = null;
  globalMetadataTime = 0;
  console.log('[Home] Cache cleared manually');
}

async function getGlobalMetadata(): Promise<GlobalMetadata> {
  const now = Date.now();
  if (globalMetadataCache && (now - globalMetadataTime < CACHE_TTL)) {
    return globalMetadataCache;
  }

  console.log('[Home] Fetching fresh global metadata');

  const [typesResult, keywordFilters, organismFilters, countResult] = await Promise.all([
    db.select({ type: papers.type }).from(papers).groupBy(papers.type),
    getKeywordFilters('', ''), // Empty strings = global
    getModelOrganismFilters('', ''),
    db.select({ value: count() }).from(papers)
  ]);

  const result: GlobalMetadata = {
    paperTypes: typesResult.map(t => t.type).sort(),
    keywordFilters,
    organismFilters,
    totalPapers: countResult[0].value
  };

  globalMetadataCache = result;
  globalMetadataTime = now;
  return result;
}

export async function getHomePageData(
  page: number = 1,
  searchQuery: string = '',
  typeFilter: string = '',
  keywordsParam: string = '',
  organismParam: string = ''
): Promise<HomePageData> {
  const PAGE_SIZE = 10;
  
  // Check if this is an unfiltered request (any page)
  const isFiltered = Boolean(searchQuery || typeFilter || keywordsParam || organismParam);
  const isFirstPageUnfiltered = !isFiltered && page === 1;

  // 1. Try Full Page Cache (for Page 1 Unfiltered)
  if (isFirstPageUnfiltered && homePageCache && (Date.now() - lastCacheTime < CACHE_TTL)) {
    console.log('[Home] Returning cached data for homepage');
    return homePageCache;
  }

  // 2. Prepare Data Components
  let totalPapers: number;
  let paperTypes: string[];
  let keywordFilters: { keyword: string; count: number }[];
  let organismFilters: { organism: string; count: number }[];

  const offset = (page - 1) * PAGE_SIZE;

  // 3. Fetch Metadata (Global vs Filtered)
  if (!isFiltered) {
    // Unfiltered: Use Global Metadata Cache
    // This makes navigating Page 2, 3, etc. much faster
    const metadata = await getGlobalMetadata();
    totalPapers = metadata.totalPapers;
    paperTypes = metadata.paperTypes;
    keywordFilters = metadata.keywordFilters;
    organismFilters = metadata.organismFilters;
  } else {
    // Filtered: Must calculate dynamic facets
    const selectedKeywords = keywordsParam ? keywordsParam.split(',').filter(Boolean) : [];
    
    // We can still reuse global paper types as they don't change based on filters usually 
    // (or we accept they are static list of all available types)
    // For strict correctness, we might want available types in this result set, 
    // but typically a filter dropdown shows all possibilities or global ones.
    // Let's reuse global types to save a query.
    const metadata = await getGlobalMetadata();
    paperTypes = metadata.paperTypes;

    // Fetch dynamic filters
    [keywordFilters, organismFilters] = await Promise.all([
      getKeywordFilters(searchQuery, typeFilter),
      getModelOrganismFilters(searchQuery, typeFilter)
    ]);

    // Calculate dynamic count
    const conditions = [];
    if (searchQuery) {
      conditions.push(or(like(papers.title, `%${searchQuery}%`), like(papers.summary, `%${searchQuery}%`)));
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

    const countResult = await db.select({ value: count() }).from(papers).where(whereClause);
    totalPapers = countResult[0].value;
  }

  // 4. Fetch Papers for current page
  // Re-construct conditions for the papers query
  const conditions = [];
  if (searchQuery) {
    conditions.push(or(like(papers.title, `%${searchQuery}%`), like(papers.summary, `%${searchQuery}%`)));
  }
  if (typeFilter) {
    conditions.push(eq(papers.type, typeFilter));
  }
  if (keywordsParam) {
    const selectedKeywords = keywordsParam.split(',').filter(Boolean);
    if (selectedKeywords.length > 0) {
      const keywordConditions = selectedKeywords.map(k => 
        sql`EXISTS (SELECT 1 FROM json_each(${papers.keywords}) WHERE value = ${k})`
      );
      conditions.push(or(...keywordConditions));
    }
  }
  if (organismParam) {
    conditions.push(eq(papers.modelOrganism, organismParam));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

  // Update Page 1 Cache if applicable
  if (isFirstPageUnfiltered) {
    homePageCache = result;
    lastCacheTime = Date.now();
    console.log('[Home] Cache updated');
  }

  return result;
}
