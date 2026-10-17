import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/env.js';
import type { AppConfig } from '../config/env.js';
import { ConfigurationError } from '../domain/errors.js';
import { createPool } from '../infrastructure/db/pool.js';
import { runMigrations } from './migrate.js';

// Destructive (ADR-014): drops the public schema. Only for the one-time reset of main and for dev/test.
const RESET_SQL = 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;';

/** Both safeguards must be present: ALLOW_DB_RESET=true in the environment and --yes on the command line. */
export function assertResetAllowed(config: AppConfig, argv: readonly string[]): void {
  if (!config.allowDbReset) {
    throw new ConfigurationError('db:reset está desactivado. Define ALLOW_DB_RESET=true solo para una reinicialización consciente.');
  }
  if (!argv.includes('--yes')) {
    throw new ConfigurationError('db:reset necesita la bandera --yes.');
  }
}

/** Host and database name for the confirmation message. The credentials are never printed. */
export function describeTarget(connectionString: string): string {
  const url = new URL(connectionString);
  return `${url.hostname}${url.pathname}`;
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  assertResetAllowed(config, process.argv.slice(2));
  console.info(`Reiniciando el esquema en: ${describeTarget(config.databaseUrlDirect)}`);
  const pool = createPool(config.databaseUrlDirect);
  try {
    await pool.query(RESET_SQL);
    const applied = await runMigrations(pool);
    console.info(`Esquema recreado. Migraciones aplicadas: ${applied.join(', ')}`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
