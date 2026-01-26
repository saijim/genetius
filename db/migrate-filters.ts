import { db, keywordFilters } from 'astro:db';
import { recomputeFilters } from '~/lib/filters';

/**
 * Migration script to populate keyword and organism filter tables.
 * This should be run once after adding the new tables to the schema.
 */
export async function runMigration() {
  console.log('[Migration] Starting filter tables migration...');

  try {
    // Check if filters already exist
    const existingKeywords = await db.select().from(keywordFilters).limit(1);
    if (existingKeywords.length > 0) {
      console.log('[Migration] Filter tables already populated, skipping migration');
      return;
    }

    // Recompute filters from existing papers
    await recomputeFilters();

    console.log('[Migration] Migration completed successfully');
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (import.meta.main) {
  runMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
