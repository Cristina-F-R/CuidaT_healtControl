import { SYNC_QUEUE_STORAGE_KEY } from '@cuidat/shared';
import type { HealthEventLog } from '@cuidat/shared';
import type { KeyValueStore } from './keyValueStore';

// Offline mutation queue for event logs (ADR-007), stored in IndexedDB under @cuidat_sync_queue_v1.
// Entries follow the ADR shape { opId, type, entityId, payload, createdAt, attempts }.

interface BaseOperation {
  opId: string;
  entityId: string;
  /** Instant the operation was first queued. */
  createdAt: string;
  attempts: number;
}

export interface UpsertOperation extends BaseOperation {
  type: 'upsert';
  payload: {
    /** Owner of the data: entries of another account are never sent with this session. */
    userId: string;
    log: HealthEventLog;
    /** The log does not exist on the server yet: a later delete cancels both operations. */
    isNew: boolean;
    /** Queued without connection: the server accepts it even if its item was archived meanwhile. */
    offline: boolean;
  };
}

export interface DeleteOperation extends BaseOperation {
  type: 'delete';
  payload: { userId: string; calendarId: string };
}

export type SyncOperation = UpsertOperation | DeleteOperation;

/** An operation the server refused with a 4xx (dead-letter list). */
export interface FailedOperation {
  operation: SyncOperation;
  status: number;
  code: string;
  failedAt: string;
}

export class SyncQueue {
  private readonly store: KeyValueStore;
  private readonly key: string;
  private readonly failedKey: string;
  /** Operations being sent right now: never merged into, so an acknowledgement cannot drop a newer edit. */
  private readonly inFlight = new Set<string>();
  private chain: Promise<unknown> = Promise.resolve();

  constructor(store: KeyValueStore, key: string = SYNC_QUEUE_STORAGE_KEY) {
    this.store = store;
    this.key = key;
    this.failedKey = `${key}.fallidos`;
  }

  async all(): Promise<SyncOperation[]> {
    return (await this.store.getItem<SyncOperation[]>(this.key)) ?? [];
  }

  async failed(): Promise<FailedOperation[]> {
    return (await this.store.getItem<FailedOperation[]>(this.failedKey)) ?? [];
  }

  /** Queues an insert or update; several upserts of the same log merge into one. */
  enqueueUpsert(userId: string, log: HealthEventLog, isNew: boolean, offline: boolean): Promise<void> {
    return this.mutate((operations) => {
      const pending = this.pendingFor(operations, log.id);
      if (pending?.type === 'upsert') {
        return operations.map((operation) =>
          operation === pending ? { ...pending, payload: { ...pending.payload, log, offline: pending.payload.offline || offline } } : operation,
        );
      }
      // After a pending delete, or while an earlier operation is in flight, the row already exists.
      const exists = pending !== undefined || this.isInFlight(operations, log.id);
      const rest = pending ? operations.filter((operation) => operation !== pending) : operations;
      const operation: UpsertOperation = { ...this.base(log.id), type: 'upsert', payload: { userId, log, isNew: isNew && !exists, offline } };
      return [...rest, operation];
    });
  }

  /** Queues a delete; it cancels a pending creation of the same log. */
  enqueueDelete(userId: string, calendarId: string, logId: string): Promise<void> {
    return this.mutate((operations) => {
      const pending = this.pendingFor(operations, logId);
      if (pending?.type === 'delete') {
        return operations;
      }
      const rest = pending ? operations.filter((operation) => operation !== pending) : operations;
      if (pending?.type === 'upsert' && pending.payload.isNew) {
        return rest;
      }
      const operation: DeleteOperation = { ...this.base(logId), type: 'delete', payload: { userId, calendarId } };
      return [...rest, operation];
    });
  }

  markInFlight(opId: string): void {
    this.inFlight.add(opId);
  }

  /** Acknowledged by the server. */
  complete(opId: string): Promise<void> {
    this.inFlight.delete(opId);
    return this.mutate((operations) => operations.filter((operation) => operation.opId !== opId));
  }

  /** Network or server error: kept for a later attempt. */
  retryLater(opId: string): Promise<void> {
    this.inFlight.delete(opId);
    return this.mutate((operations) =>
      operations.map((operation) => (operation.opId === opId ? { ...operation, attempts: operation.attempts + 1 } : operation)),
    );
  }

  /** Kept as it was, without counting an attempt (for example, the session expired). */
  release(opId: string): void {
    this.inFlight.delete(opId);
  }

  /** Refused by the server (4xx): moved to the dead-letter list. */
  fail(opId: string, status: number, code: string): Promise<void> {
    this.inFlight.delete(opId);
    return this.exclusive(async () => {
      const operations = await this.all();
      const operation = operations.find((candidate) => candidate.opId === opId);
      if (!operation) {
        return;
      }
      await this.store.setItem(this.failedKey, [...(await this.failed()), { operation, status, code, failedAt: new Date().toISOString() }]);
      await this.store.setItem(this.key, operations.filter((candidate) => candidate.opId !== opId));
    });
  }

  clearFailed(): Promise<void> {
    return this.exclusive(() => this.store.removeItem(this.failedKey));
  }

  /** Empties the queue and the dead-letter list (account deletion). */
  clear(): Promise<void> {
    this.inFlight.clear();
    return this.exclusive(async () => {
      await this.store.removeItem(this.key);
      await this.store.removeItem(this.failedKey);
    });
  }

  /** The latest operation of the entity that is not being sent. */
  private pendingFor(operations: readonly SyncOperation[], entityId: string): SyncOperation | undefined {
    return [...operations].reverse().find((operation) => operation.entityId === entityId && !this.inFlight.has(operation.opId));
  }

  private isInFlight(operations: readonly SyncOperation[], entityId: string): boolean {
    return operations.some((operation) => operation.entityId === entityId && this.inFlight.has(operation.opId));
  }

  private base(entityId: string): BaseOperation {
    return { opId: crypto.randomUUID(), entityId, createdAt: new Date().toISOString(), attempts: 0 };
  }

  private mutate(change: (operations: SyncOperation[]) => SyncOperation[]): Promise<void> {
    return this.exclusive(async () => {
      await this.store.setItem(this.key, change(await this.all()));
    });
  }

  /** Serialises every read-modify-write, so two quick mutations cannot overwrite each other. */
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.chain.then(work, work);
    this.chain = result.catch(() => undefined);
    return result;
  }
}
