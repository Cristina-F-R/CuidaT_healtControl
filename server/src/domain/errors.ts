/** Base of every error the API answers on purpose. The error mapper turns it into HTTP. */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(400, code, message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Necesitas iniciar sesión.') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Petición no permitida.') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'No se encontró el recurso.') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT') {
    super(409, code, message);
    this.name = 'ConflictError';
  }
}

/** Invalid environment or startup settings. Fails fast, before the server listens. */
export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(500, 'CONFIGURATION_ERROR', message);
    this.name = 'ConfigurationError';
  }
}

/** An unexpected state inside the server. Answered as a generic 500; the detail goes to logs only. */
export class InternalError extends AppError {
  constructor(message: string) {
    super(500, 'INTERNAL_ERROR', message);
    this.name = 'InternalError';
  }
}
