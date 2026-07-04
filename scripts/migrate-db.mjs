import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.AEGIS_DATABASE_URL ||
  "postgresql://enterprise:enterprise_secret@localhost:5432/enterprise_agents";
const migrationsDir = path.resolve(process.cwd(), "docker/migrations");

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const { rows } = await client.query(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (rows[0]) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`apply ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log(`migrations complete (${files.length} available)`);
}

main()
  .catch((error) => {
    console.error("migration failed");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
