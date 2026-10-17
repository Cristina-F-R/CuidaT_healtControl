import { logsResponseSchema } from '@cuidat/shared';
import type { HealthEventLog } from '@cuidat/shared';
import type { EventRepository, LogRange } from '../../application/ports/repositories';
import { apiRequest, NetworkError } from '../http/apiClient';
import type { OfflineCache } from '../sync/OfflineCache';
import type { SyncOperation, SyncQueue } from '../sync/SyncQueue';

function inRange(log: HealthEventLog, range: LogRange): boolean {
  const instant = Date.parse(log.loggedAt);
  return instant >= Date.parse(range.from) && instant <= Date.parse(range.to);
}

/** Server rows with the operations that are still queued applied on top, in queue order. */
export function applyPendingOperations(
  logs: readonly HealthEventLog[],
  operations: readonly SyncOperation[],
  userId: string,
  calendarId: string,
  range: LogRange,
): HealthEventLog[] {
  const byId = new Map(logs.map((log) => [log.id, log]));
  for (const operation of operations) {
    if (operation.payload.userId !== userId) {
      continue;
    }
    if (operation.type === 'delete') {
      byId.delete(operation.entityId);
    } else if (operation.payload.log.calendarId === calendarId && inRange(operation.payload.log, range)) {
      byId.set(operation.entityId, operation.payload.log);
    } else {
      byId.delete(operation.entityId);
    }
  }
  return [...byId.values()];
}

/**
 * Event logs of a registered user, offline first (ADR-007): writes go to the sync queue and are
 * sent by useSyncStore; reads merge the server (or the offline cache) with what is still queued.
 */
export class ApiEventRepository implements EventRepository {
  private readonly userId: string;
  private readonly queue: SyncQueue;
  private readonly cache: OfflineCache;

  constructor(userId: string, queue: SyncQueue, cache: OfflineCache) {
    this.userId = userId;
    this.queue = queue;
    this.cache = cache;
  }

  async list(calendarId: string, range: LogRange): Promise<HealthEventLog[]> {
    let logs: HealthEventLog[];
    try {
      const query = new URLSearchParams({ from: range.from, to: range.to });
      logs = logsResponseSchema.parse(await apiRequest('GET', `/profiles/${calendarId}/events?${query.toString()}`)).logs;
      await this.cache.putLogs(calendarId, range, logs);
    } catch (error) {
      if (!(error instanceof NetworkError)) {
        throw error;
      }
      logs = (await this.cache.logs(calendarId)).filter((log) => inRange(log, range));
    }
    return applyPendingOperations(logs, await this.queue.all(), this.userId, calendarId, range);
  }

  async save(log: HealthEventLog, isNew: boolean): Promise<void> {
    await this.queue.enqueueUpsert(this.userId, log, isNew, !navigator.onLine);
  }

  async remove(calendarId: string, logId: string): Promise<void> {
    await this.queue.enqueueDelete(this.userId, calendarId, logId);
  }
}
