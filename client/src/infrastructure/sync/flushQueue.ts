import { ApiError, apiRequest, NetworkError } from '../http/apiClient';
import type { SyncOperation, SyncQueue } from './SyncQueue';

export type FlushStatus =
  /** Nothing left for this user. */
  | 'done'
  /** Network failure, 5xx or 429: try again later with backoff. */
  | 'retry'
  /** The session expired: the queue waits for a new sign-in. */
  | 'unauthorized';

export interface FlushResult {
  status: FlushStatus;
  /** Operations refused in this run (4xx) and moved to the dead-letter list. */
  failed: number;
}

export type SendOperation = (operation: SyncOperation) => Promise<void>;

/** HTTP call of one queued operation. Both endpoints are idempotent, so a retry is always safe. */
export async function sendOperation(operation: SyncOperation): Promise<void> {
  if (operation.type === 'delete') {
    await apiRequest('DELETE', `/profiles/${operation.payload.calendarId}/events/${operation.entityId}`);
    return;
  }
  const { log, offline } = operation.payload;
  await apiRequest('PUT', `/profiles/${log.calendarId}/events/${log.id}`, {
    itemDefinitionId: log.itemDefinitionId,
    loggedAt: log.loggedAt,
    intensity: log.intensity,
    durationMinutes: log.durationMinutes,
    notes: log.notes,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    // Recorded earlier and synced now (ADR-007): accepted even if the item was archived meanwhile.
    deferred: offline || operation.attempts > 0,
  });
}

function isRetryable(error: unknown): boolean {
  return error instanceof NetworkError || (error instanceof ApiError && (error.status >= 500 || error.status === 429));
}

/**
 * Sends the queued operations of `userId` in order (ADR-007). 2xx removes the entry, 4xx moves it to
 * the dead-letter list and goes on, network/5xx stops the run so the order is kept.
 */
export async function flushQueue(queue: SyncQueue, userId: string, send: SendOperation = sendOperation): Promise<FlushResult> {
  let failed = 0;
  const attempted = new Set<string>();
  for (;;) {
    const next = (await queue.all()).find((operation) => operation.payload.userId === userId && !attempted.has(operation.opId));
    if (!next) {
      return { status: 'done', failed };
    }
    attempted.add(next.opId);
    queue.markInFlight(next.opId);
    try {
      await send(next);
      await queue.complete(next.opId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        queue.release(next.opId);
        return { status: 'unauthorized', failed };
      }
      if (isRetryable(error)) {
        await queue.retryLater(next.opId);
        return { status: 'retry', failed };
      }
      if (!(error instanceof ApiError)) {
        queue.release(next.opId);
        throw error;
      }
      await queue.fail(next.opId, error.status, error.code);
      failed += 1;
    }
  }
}
