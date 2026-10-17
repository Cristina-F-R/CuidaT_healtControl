import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config/env.js';
import { createApp } from './interfaces/http/app.js';
import { PgAccountRepository } from './infrastructure/repositories/PgAccountRepository.js';
import { BcryptPasswordHasher } from './infrastructure/security/BcryptPasswordHasher.js';
import { JwtSessionTokens } from './infrastructure/security/JwtSessionTokens.js';
import { consoleLogger } from './infrastructure/observability/logger.js';
import { initErrorReporting, reportUnexpectedError } from './infrastructure/observability/sentry.js';
import { createPool } from './infrastructure/db/pool.js';

// Composition root (TECH_SPEC.md section 3.1): the only place where adapters meet the application.
const config = loadConfig(process.env);
initErrorReporting(config);

const pool = createPool(config.databaseUrl);
const app = createApp({
  config,
  account: {
    accounts: new PgAccountRepository(pool),
    hasher: new BcryptPasswordHasher(),
    clock: () => new Date(),
    newId: () => crypto.randomUUID(),
  },
  sessions: new JwtSessionTokens(config.jwtSecret, config.jwtExpiresInSeconds),
  logger: consoleLogger,
  reportError: reportUnexpectedError,
  clientDir: fileURLToPath(new URL('../../client/dist/', import.meta.url)),
});

const server = app.listen(config.port, () => {
  console.info(`CuidaT API escuchando en el puerto ${config.port} (${config.nodeEnv})`);
});

function shutdown(): void {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
