import express, { Router } from 'express';
import type { CookieOptions, Response } from 'express';
import { loginBodySchema, registerBodySchema } from '@cuidat/shared';
import type { AppConfig } from '../../../config/env.js';
import { UnauthorizedError } from '../../../domain/errors.js';
import type { SessionTokens } from '../../../domain/ports.js';
import { loginAccount, getAccount, registerAccount } from '../../../application/auth/accounts.js';
import type { AccountDependencies } from '../../../application/auth/accounts.js';
import type { Logger } from '../../../infrastructure/observability/logger.js';
import { authRateLimit } from '../middleware/rateLimits.js';
import { requireSession, SESSION_COOKIE } from '../middleware/guards.js';

export interface AuthRouteDependencies {
  config: AppConfig;
  account: AccountDependencies;
  sessions: SessionTokens;
  logger: Logger;
}

/** Registration sends the guest calendar, which can be larger than the default JSON limit. */
const REGISTER_BODY_LIMIT = '1mb';

function cookieOptions(config: AppConfig): CookieOptions {
  // SameSite=Lax (TECH_SPEC section 7); Secure only in production, where the site is HTTPS.
  return { httpOnly: true, sameSite: 'lax', secure: config.isProduction, path: '/' };
}

function setSessionCookie(res: Response, config: AppConfig, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: config.jwtExpiresInSeconds * 1000 });
}

export function authRouter(deps: AuthRouteDependencies): Router {
  const { config, account, sessions, logger } = deps;
  const router = Router();
  const limiter = authRateLimit(config.authRateLimitMax);

  router.post('/register', limiter, express.json({ limit: REGISTER_BODY_LIMIT }), async (req, res) => {
    const body = registerBodySchema.parse(req.body);
    const created = await registerAccount(account, body);
    logger.security('account_registered', { userId: created.id });
    setSessionCookie(res, config, sessions.issue(created.id));
    res.status(201).json({ user: created });
  });

  router.post('/login', limiter, async (req, res) => {
    const body = loginBodySchema.parse(req.body);
    try {
      const signedIn = await loginAccount(account, body);
      logger.security('login_succeeded', { userId: signedIn.id });
      setSessionCookie(res, config, sessions.issue(signedIn.id));
      res.json({ user: signedIn });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        logger.security('login_failed');
      }
      throw error;
    }
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, cookieOptions(config));
    logger.security('logged_out');
    res.status(204).end();
  });

  router.get('/me', requireSession(sessions), async (_req, res) => {
    const userId = typeof res.locals['userId'] === 'string' ? res.locals['userId'] : '';
    res.json({ user: await getAccount(account, userId) });
  });

  return router;
}
