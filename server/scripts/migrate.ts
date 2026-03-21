import { Client } from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!config.DATABASE_URL) {
    console.error("Missing DATABASE_URL. Skipping PG migrations.");
    process.exit(0); // Optional: we might not use PG in all envs yet
  }
  const client = new Client({ connectionString: config.DATABASE_URL });
  try {
    await client.connect();
    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    
    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await client.query(sql);
    }
    console.log("All migrations applied successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
