import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DomainRuleError } from '@cuidat/shared';
import { AppError, NotFoundError } from '../../../domain/errors.js';
import type { Logger } from '../../../infrastructure/observability/logger.js';

interface ErrorBody {
  error: { code: string; message: string; fields?: string[] };
}

const NOT_FOUND_RULES = new Set(['ITEM_NOT_FOUND', 'PROFILE_NOT_FOUND']);

function bodyParserStatus(error: unknown): { status: number; code: string; message: string } | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return null;
  }
  if (error.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande.' };
  }
  if (error.type === 'entity.parse.failed' || error.type === 'encoding.unsupported') {
    return { status: 400, code: 'MALFORMED_BODY', message: 'El cuerpo de la petición no es JSON válido.' };
  }
  return null;
}

/**
 * Translates every error into the same JSON shape. Field names are returned for validation errors,
 * never the values. Unexpected errors become a generic 500 and are reported without their message.
 */
export function errorHandler(logger: Logger, report: (error: unknown) => void): ErrorRequestHandler {
  return (error: unknown, _req, res, next): void => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof ZodError) {
      const body: ErrorBody = {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Los datos enviados no son válidos.',
          fields: [...new Set(error.issues.map((issue) => issue.path.join('.') || '(cuerpo)'))],
        },
      };
      res.status(400).json(body);
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ error: { code: error.code, message: error.message } satisfies ErrorBody['error'] });
      return;
    }
    if (error instanceof DomainRuleError) {
      const status = NOT_FOUND_RULES.has(error.code) ? 404 : error.code === 'GUEST_LIMIT' ? 409 : 400;
      res.status(status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const parsed = bodyParserStatus(error);
    if (parsed) {
      res.status(parsed.status).json({ error: { code: parsed.code, message: parsed.message } });
      return;
    }
    logger.unexpected(error);
    report(error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } });
  };
}

export function notFoundHandler(): ErrorRequestHandler {
  return (_error, _req, _res, next): void => {
    next(new NotFoundError('La ruta no existe.'));
  };
}
