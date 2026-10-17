import path from 'node:path';
import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import type { AppConfig } from '../../config/env.js';
import { NotFoundError } from '../../domain/errors.js';
import type { SessionTokens } from '../../domain/ports.js';
import type { AccountDependencies } from '../../application/auth/accounts.js';
import type { DataDependencies } from '../../application/data/dataDependencies.js';
import type { Logger } from '../../infrastructure/observability/logger.js';
import { errorHandler } from './middleware/errors.js';
import { requireSameSiteClient } from './middleware/guards.js';
import { apiRateLimit } from './middleware/rateLimits.js';
import { authRouter } from './routes/authRoutes.js';
import { dataRouter } from './routes/dataRoutes.js';

export interface AppDependencies {
  config: AppConfig;
  account: AccountDependencies;
  data: DataDependencies;
  sessions: SessionTokens;
  logger: Logger;
  reportError: (error: unknown) => void;
  /** Folder with the built web client, served when SERVE_CLIENT=true (single origin, ADR-019). */
  clientDir?: string;
}

const JSON_LIMIT = '100kb';

function contentSecurityPolicy(config: AppConfig): NonNullable<Parameters<typeof helmet>[0]>['contentSecurityPolicy'] {
  const sentryConnect = config.sentryDsn ? [new URL(config.sentryDsn).origin] : [];
  return {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", ...sentryConnect],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Only for an HTTPS origin: on plain HTTP (local runs) the browser would upgrade the assets and fail.
      upgradeInsecureRequests: config.clientOrigin.startsWith('https:') ? [] : null,
    },
  };
}

/** Builds the Express application. Every dependency is injected, so tests can replace them. */
export function createApp(deps: AppDependencies): Express {
  const { config, logger } = deps;
  const app = express();
  app.disable('x-powered-by');
  // One proxy hop (Render's router): the rate limiter then sees the client address, not the proxy.
  app.set('trust proxy', 1);

  app.use(helmet({ contentSecurityPolicy: contentSecurityPolicy(config) }));
  app.use(cors({
    origin: config.clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CuidaT-Client'],
  }));
  app.use(cookieParser());

  app.use('/api', requireSameSiteClient(config.clientOrigin));
  app.use('/api', apiRateLimit());
  // Register parses its own, larger body (see authRouter); everything else keeps the small limit.
  const jsonParser = express.json({ limit: JSON_LIMIT });
  app.use('/api', (req: Request, res: Response, next: NextFunction) => (req.path === '/auth/register' ? next() : jsonParser(req, res, next)));

  app.use('/api/auth', authRouter({ config, account: deps.account, sessions: deps.sessions, logger }));
  app.use('/api/profiles', dataRouter(deps.data, deps.sessions));
  app.use('/api', (_req: Request, _res: Response, next: NextFunction) => next(new NotFoundError('La ruta no existe.')));

  if (config.serveClient && deps.clientDir) {
    const indexFile = path.join(deps.clientDir, 'index.html');
    app.use(express.static(deps.clientDir, { index: false }));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(indexFile);
        return;
      }
      next();
    });
  }

  app.use(errorHandler(logger, deps.reportError));
  return app;
}
