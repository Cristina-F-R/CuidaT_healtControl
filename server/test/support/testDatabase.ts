import net from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import { runMigrations } from '../../src/db/migrate.js';
import { loadConfig } from '../../src/config/env.js';
import type { AppConfig } from '../../src/config/env.js';
import { createApp } from '../../src/interfaces/http/app.js';
import type { Logger } from '../../src/infrastructure/observability/logger.js';
import { PgAccountRepository } from '../../src/infrastructure/repositories/PgAccountRepository.js';
import { BcryptPasswordHasher } from '../../src/infrastructure/security/BcryptPasswordHasher.js';
import { JwtSessionTokens } from '../../src/infrastructure/security/JwtSessionTokens.js';

// Real PostgreSQL 18 (PGlite, in memory) behind the socket protocol, so the `pg` driver and the SQL
// are exercised for real. The Neon dev/test branches are used only for the E2E suites (Phase 3.3).
export interface TestDatabase {
  pool: Pool;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('Sin puerto libre'))));
    });
  });
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const port = await freePort();
  const db = await PGlite.create();
  const socket = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await socket.start();
  const pool = new Pool({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres?sslmode=disable`, max: 1 });
  await runMigrations(pool);
  return {
    pool,
    reset: async (): Promise<void> => {
      await pool.query('TRUNCATE users, calendar_profiles, health_item_definitions, health_event_logs CASCADE');
    },
    close: async (): Promise<void> => {
      await pool.end();
      await socket.stop();
      await db.close();
    },
  };
}

export const TEST_ORIGIN = 'http://localhost:5173';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    CLIENT_ORIGIN: TEST_ORIGIN,
    DATABASE_URL: 'unused',
    DATABASE_URL_DIRECT: 'unused',
    JWT_SECRET: 'test-secret-with-more-than-32-characters',
    AUTH_RATE_LIMIT_MAX: '100',
    ...overrides,
  });
}

export const silentLogger: Logger = {
  security: (): void => undefined,
  unexpected: (): void => undefined,
};

export function buildTestApp(db: TestDatabase, overrides: Record<string, string> = {}): ReturnType<typeof createApp> {
  const config = testConfig(overrides);
  return createApp({
    config,
    account: {
      accounts: new PgAccountRepository(db.pool),
      hasher: new BcryptPasswordHasher(),
      clock: () => new Date(),
      newId: () => crypto.randomUUID(),
    },
    sessions: new JwtSessionTokens(config.jwtSecret, config.jwtExpiresInSeconds),
    logger: silentLogger,
    reportError: () => undefined,
  });
}
