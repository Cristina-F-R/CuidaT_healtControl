import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { loadConfig } from '../config/env.js';
import { createPool } from '../infrastructure/db/pool.js';

// Advisory lock key: two containers starting at once must not run the same migration twice.
const MIGRATION_LOCK = 4_242_001;
export const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

/**
 * Applies the pending migrations in file-name order, each in its own transaction, and records them
 * in schema_migrations. Idempotent: applied versions are skipped and no data is deleted.
 * Returns the versions applied by this run.
 */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    const done = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const doneVersions = new Set(done.rows.map((row) => row.version));
    const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (doneVersions.has(version)) {
        continue;
      }
      const sql = await readFile(`${MIGRATIONS_DIR}${file}`, 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      applied.push(version);
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]);
    client.release();
  }
}

/** Command line entry point: `npm run db:migrate` (uses the direct connection, not the pooler). */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrlDirect);
  try {
    const applied = await runMigrations(pool);
    console.info(applied.length > 0 ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Esquema al día: no hay migraciones pendientes.');
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
