#!/usr/bin/env bun
/**
 * Script to populate keyword and organism filter tables.
 * Run this after adding the new tables to the schema.
 */

import { db, keywordFilters, papers, sql } from 'astro:db';

async function populateFilters() {
  console.log('[Migration] Starting filter tables population...');

  try {
    // Check if filters already exist
    const existingKeywords = await db.select().from(keywordFilters).limit(1);
    if (existingKeywords.length > 0) {
      console.log('[Migration] Filter tables already populated, skipping');
      return;
    }

    console.log('[Migration] Computing keyword filters...');
    const keywordQuery = sql`
      INSERT INTO keywordFilters (keyword, count)
      SELECT "value" as keyword, count(DISTINCT ${papers.id}) as count
      FROM ${papers}, json_each(${papers.keywords})
      GROUP BY "value"
    `;

    console.log('[Migration] Computing organism filters...');
    const organismQuery = sql`
      INSERT INTO organismFilters (organism, count)
      SELECT modelOrganism, count(*)
      FROM ${papers}
      WHERE modelOrganism IS NOT NULL
      GROUP BY modelOrganism
    `;

    // Execute both filter computations atomically using batch
    await db.batch([
      db.run(keywordQuery),
      db.run(organismQuery)
    ]);

    console.log('[Migration] Migration completed successfully');
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    process.exit(1);
  }
}

populateFilters()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
