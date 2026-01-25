import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_DB_PATH = join(__dirname, "../local.db");

const REMOTE_URL = process.env.ASTRO_DB_REMOTE_URL;
const REMOTE_TOKEN = process.env.ASTRO_DB_APP_TOKEN;

if (!REMOTE_URL || !REMOTE_TOKEN) {
  console.error(
    "Error: ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN environment variables must be set.",
  );
  process.exit(1);
}

async function migrate() {
  console.log("Starting migration...");
  console.log(`Reading from local DB: ${LOCAL_DB_PATH}`);
  console.log(`Writing to remote DB: ${REMOTE_URL}`);

  // Connect to Local DB
  let localDb;
  try {
    localDb = new Database(LOCAL_DB_PATH, { readonly: true });
  } catch (err) {
    console.error(`Failed to open local database: ${err.message}`);
    process.exit(1);
  }

  // Connect to Remote DB
  const remoteClient = createClient({
    url: REMOTE_URL,
    authToken: REMOTE_TOKEN,
  });

  const tables = ["papers", "refreshLogs"];

  for (const tableName of tables) {
    console.log(`\nMigrating table: ${tableName}`);

    // Get all records from local
    let records;
    try {
      records = localDb.prepare(`SELECT * FROM ${tableName}`).all();
      console.log(`Found ${records.length} records in local ${tableName}`);
    } catch (err) {
      console.warn(
        `Could not read table ${tableName} from local DB. Skipping. Error: ${err.message}`,
      );
      continue;
    }

    if (records.length === 0) {
      console.log(`No records to migrate for ${tableName}`);
      continue;
    }

    // Insert into remote
    let successCount = 0;
    let errorCount = 0;

    // Process in batches to avoid overwhelming the network
    const BATCH_SIZE = 50;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const promises = batch.map(async (record) => {
        const keys = Object.keys(record);
        const placeholders = keys.map(() => "?").join(", ");
        const sql = `INSERT OR IGNORE INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`;
        const args = Object.values(record);

        try {
          await remoteClient.execute({ sql, args });
          return true;
        } catch (err) {
          console.error(
            `Failed to insert record ID ${record.id} into ${tableName}: ${err.message}`,
          );
          return false;
        }
      });

      const results = await Promise.all(promises);
      successCount += results.filter(Boolean).length;
      errorCount += results.filter((r) => !r).length;

      console.log(
        `Processed ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} records...`,
      );
    }

    console.log(
      `Finished ${tableName}: ${successCount} inserted/ignored, ${errorCount} failed.`,
    );
  }

  localDb.close();
  console.log("\nMigration complete.");
}

migrate().catch(console.error);
