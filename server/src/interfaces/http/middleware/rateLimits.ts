import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function tooMany(message: string): RequestHandler {
  return (_req, res): void => {
    res.status(429).json({ error: { code: 'RATE_LIMITED', message } });
  };
}

/** OWASP A07: register and login share a per-IP budget per 15 minutes (AUTH_RATE_LIMIT_MAX). */
export function authRateLimit(max: number): RequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany('Demasiados intentos. Vuelve a intentarlo más tarde.'),
  });
}

/** Everything else under /api: 100 requests per minute per IP, including account deletion. */
export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: ONE_MINUTE_MS,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooMany('Demasiadas peticiones. Espera un momento.'),
  });
}
