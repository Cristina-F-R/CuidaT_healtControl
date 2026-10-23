import { DomainRuleError } from '@cuidat/shared';
import { ApiError, NetworkError } from '../infrastructure/http/apiClient';

/** Sign-out refused: some logs are still waiting in the sync queue (ADR-007). */
export class PendingChangesError extends Error {
  readonly pending: number;

  constructor(pending: number) {
    super(
      pending === 1
        ? 'Hay 1 registro pendiente de sincronizar. Conéctate a internet antes de cerrar la sesión.'
        : `Hay ${pending} registros pendientes de sincronizar. Conéctate a internet antes de cerrar la sesión.`,
    );
    this.name = 'PendingChangesError';
    this.pending = pending;
  }
}

/**
 * Text for an error the user can act on: a broken rule, a refused request or no connection
 * (profiles and the catalog need it in v1, ADR-007). Anything else is a bug and is rethrown,
 * so it reaches the global error handler.
 */
export function userMessageOf(error: unknown): string {
  if (error instanceof DomainRuleError || error instanceof PendingChangesError) {
    return error.message;
  }
  if (error instanceof NetworkError) {
    return 'Este cambio necesita conexión a internet. Inténtalo de nuevo cuando vuelvas a estar en línea.';
  }
  if (error instanceof ApiError) {
    return error.status >= 500 ? 'El servidor no está disponible. Inténtalo más tarde.' : error.message;
  }
  throw error;
}
