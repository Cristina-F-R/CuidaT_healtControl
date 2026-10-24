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

  it('applies every migration once, in order, and records them', async () => {
    const versions = await db.pool.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
    expect(versions.rows.map((row) => row.version)).toEqual(['001_init', '002_color_theme_check']);
  });

  it('refuses a color theme outside the palette (002_color_theme_check)', async () => {
    // One transaction, rolled back: the refused insert leaves neither rows nor a broken connection.
    const client = await db.pool.connect();
    const insert = (theme: string): Promise<unknown> =>
      client.query(
        `INSERT INTO calendar_profiles (user_id, name, profile_type, color_theme)
         VALUES ((SELECT id FROM users WHERE email = 'color@example.com'), 'Luna', 'Adulto', $1)`,
        [theme],
      );
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO users (email, password_hash) VALUES ('color@example.com', 'x')`);
      await expect(insert('mint')).resolves.toBeDefined();
      await expect(insert('red')).rejects.toThrow(/ck_profile_color_theme/);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });

  it('does nothing when run again (idempotent, no data loss)', async () => {
    expect(await runMigrations(db.pool)).toEqual([]);
  });
});
