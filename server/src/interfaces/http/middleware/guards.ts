import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors.js';
import type { SessionTokens } from '../../../domain/ports.js';

export const SESSION_COOKIE = 'cuidat_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence (TECH_SPEC.md section 7): state-changing requests must send the custom header
 * `X-CuidaT-Client: web` (it forces a CORS preflight) and an Origin equal to CLIENT_ORIGIN.
 */
export function requireSameSiteClient(clientOrigin: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    if (req.get('X-CuidaT-Client') !== 'web' || req.get('Origin') !== clientOrigin) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}

/** Reads the session cookie, verifies the token and stores the user id in `res.locals.userId`. */
export function requireSession(sessions: SessionTokens): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const raw: unknown = req.cookies?.[SESSION_COOKIE];
    const userId = typeof raw === 'string' ? sessions.verify(raw) : null;
    if (!userId) {
      next(new UnauthorizedError());
      return;
    }
    res.locals['userId'] = userId;
    next();
  };
}
