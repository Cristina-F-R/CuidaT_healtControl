import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase } from '../../test/support/testDatabase.js';
import type { TestDatabase } from '../../test/support/testDatabase.js';
import { runMigrations } from './migrate.js';

describe('runMigrations', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('applies 001_init once and records it', async () => {
    const versions = await db.pool.query<{ version: string }>('SELECT version FROM schema_migrations');
    expect(versions.rows.map((row) => row.version)).toEqual(['001_init']);
  });

  it('does nothing when run again (idempotent, no data loss)', async () => {
    expect(await runMigrations(db.pool)).toEqual([]);
  });
});
