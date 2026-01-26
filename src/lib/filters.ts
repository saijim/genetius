import { db, papers, keywordFilters, organismFilters, sql } from 'astro:db';

/**
 * Recomputes and stores keyword and organism filters.
 * This should be called after adding/updating papers.
 */
export async function recomputeFilters() {
  console.log('[Filters] Recomputing keyword and organism filters...');

  try {
    // Recompute keyword filters using SQL aggregation
    const keywordQuery = sql`
      INSERT INTO keywordFilters (keyword, count)
      SELECT "value" as keyword, count(DISTINCT ${papers.id}) as count
      FROM ${papers}, json_each(${papers.keywords})
      GROUP BY "value"
      ON CONFLICT(keyword) DO UPDATE SET
        count = excluded.count,
        lastUpdated = datetime('now')
    `;

    // Recompute organism filters using SQL aggregation
    const organismQuery = sql`
      INSERT INTO organismFilters (organism, count)
      SELECT modelOrganism, count(*)
      FROM ${papers}
      WHERE modelOrganism IS NOT NULL
      GROUP BY modelOrganism
      ON CONFLICT(organism) DO UPDATE SET
        count = excluded.count,
        lastUpdated = datetime('now')
    `;

    await Promise.all([
      db.run(keywordQuery),
      db.run(organismQuery)
    ]);

    console.log('[Filters] Filters recomputed successfully');
  } catch (error) {
    console.error('[Filters] Failed to recompute filters:', error);
    throw error;
  }
}

/**
 * Gets keyword filters from pre-computed table.
 * Falls back to live computation if table is empty or outdated.
 */
export async function getKeywordFilters(
  searchQuery?: string,
  typeFilter?: string,
  limit: number = 20
): Promise<{ keyword: string; count: number }[]> {
  // For unfiltered views, use pre-computed filters
  if (!searchQuery && !typeFilter) {
    try {
      const result = await db
        .select({
          keyword: keywordFilters.keyword,
          count: keywordFilters.count
        })
        .from(keywordFilters)
        .orderBy(sql`${keywordFilters.count} DESC`)
        .limit(limit);

      if (result.length > 0) {
        console.log('[Filters] Using pre-computed keyword filters');
        return result;
      }
    } catch (error) {
      console.warn('[Filters] Failed to fetch pre-computed keyword filters, falling back to live computation:', error);
    }
  }

  // Fall back to live computation for filtered views or if pre-computed data is unavailable
  console.log('[Filters] Computing keyword filters live');
  const { getKeywordFilters: getKeywordFiltersLive } = await import('~/lib/trends');
  return getKeywordFiltersLive(searchQuery, typeFilter);
}

/**
 * Gets organism filters from pre-computed table.
 * Falls back to live computation if table is empty or outdated.
 */
export async function getModelOrganismFilters(
  searchQuery?: string,
  typeFilter?: string,
  limit: number = 20
): Promise<{ organism: string; count: number }[]> {
  // For unfiltered views, use pre-computed filters
  if (!searchQuery && !typeFilter) {
    try {
      const result = await db
        .select({
          organism: organismFilters.organism,
          count: organismFilters.count
        })
        .from(organismFilters)
        .orderBy(sql`${organismFilters.count} DESC`)
        .limit(limit);

      if (result.length > 0) {
        console.log('[Filters] Using pre-computed organism filters');
        return result;
      }
    } catch (error) {
      console.warn('[Filters] Failed to fetch pre-computed organism filters, falling back to live computation:', error);
    }
  }

  // Fall back to live computation for filtered views or if pre-computed data is unavailable
  console.log('[Filters] Computing organism filters live');
  const { getModelOrganismFilters: getModelOrganismFiltersLive } = await import('~/lib/trends');
  return getModelOrganismFiltersLive(searchQuery, typeFilter);
}
