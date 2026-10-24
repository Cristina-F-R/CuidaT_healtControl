import type { HealthEventLog } from '@cuidat/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../http/apiClient';
import { applyPendingOperations } from '../api/ApiEventRepository';
import { flushQueue } from './flushQueue';
import { createMemoryStore } from './keyValueStore';
import { OfflineCache } from './OfflineCache';
import { SyncQueue } from './SyncQueue';
import type { SyncOperation } from './SyncQueue';

const USER = 'u-1';
const CALENDAR = 'c-1';

function log(id: string, overrides: Partial<HealthEventLog> = {}): HealthEventLog {
  return {
    id, calendarId: CALENDAR, itemDefinitionId: 'i-1', loggedAt: '2026-10-10T09:00:00.000Z', intensity: 2, durationMinutes: null,
    notes: null, createdAt: '2026-10-10T09:00:00.000Z', updatedAt: '2026-10-10T09:00:00.000Z', ...overrides,
  };
}

describe('SyncQueue (ADR-007)', () => {
  let queue: SyncQueue;

  beforeEach(() => {
    queue = new SyncQueue(createMemoryStore());
  });

  it('stores entries with the ADR shape', async () => {
    await queue.enqueueUpsert(USER, log('a'), true, false);
    const [entry] = await queue.all();
    expect(entry).toMatchObject({ type: 'upsert', entityId: 'a', attempts: 0, payload: { userId: USER, isNew: true, offline: false } });
    expect(entry?.opId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('merges several upserts of the same log into one, keeping it new', async () => {
    await queue.enqueueUpsert(USER, log('a'), true, true);
    await queue.enqueueUpsert(USER, log('a', { intensity: 3 }), false, false);
    const entries = await queue.all();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ type: 'upsert', payload: { isNew: true, offline: true, log: { intensity: 3 } } });
  });

  it('cancels a creation followed by a delete, and turns an edit followed by a delete into a delete', async () => {
    await queue.enqueueUpsert(USER, log('new'), true, false);
    await queue.enqueueDelete(USER, CALENDAR, 'new');
    await queue.enqueueUpsert(USER, log('old'), false, false);
    await queue.enqueueDelete(USER, CALENDAR, 'old');
    await queue.enqueueDelete(USER, CALENDAR, 'old');
    const entries = await queue.all();
    expect(entries.map((entry) => `${entry.type}:${entry.entityId}`)).toEqual(['delete:old']);
  });

  it('never merges into an operation in flight, so its acknowledgement cannot drop a newer edit', async () => {
    await queue.enqueueUpsert(USER, log('a'), true, false);
    const [sending] = await queue.all();
    queue.markInFlight(sending!.opId);
    await queue.enqueueUpsert(USER, log('a', { intensity: 3 }), false, false);
    await queue.complete(sending!.opId);
    const entries = await queue.all();
    expect(entries).toHaveLength(1);
    // The row will exist on the server, so a later delete must be sent, not cancelled.
    expect(entries[0]).toMatchObject({ payload: { isNew: false, log: { intensity: 3 } } });
  });

  it('discards the pending operations of a deleted calendar, but not the ones in flight', async () => {
    await queue.enqueueUpsert(USER, log('a'), true, false);
    await queue.enqueueDelete(USER, CALENDAR, 'b');
    await queue.enqueueUpsert(USER, log('c'), true, false);
    await queue.enqueueUpsert(USER, log('other', { calendarId: 'c-2' }), true, false);
    const sending = (await queue.all()).find((entry) => entry.entityId === 'c')!;
    queue.markInFlight(sending.opId);
    await queue.discardCalendar(CALENDAR);
    const entries = await queue.all();
    expect(entries.map((entry) => entry.entityId)).toEqual(['c', 'other']);
  });

  it('serialises concurrent writes', async () => {
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => queue.enqueueUpsert(USER, log(id), true, false)));
    expect((await queue.all()).map((entry) => entry.entityId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moves refused operations to the dead-letter list and clears everything', async () => {
    await queue.enqueueUpsert(USER, log('a'), true, false);
    const [entry] = await queue.all();
    await queue.fail(entry!.opId, 400, 'FUTURE_DATE');
    expect(await queue.all()).toEqual([]);
    expect(await queue.failed()).toMatchObject([{ status: 400, code: 'FUTURE_DATE', operation: { entityId: 'a' } }]);
    await queue.enqueueDelete(USER, CALENDAR, 'b');
    await queue.clear();
    expect(await queue.all()).toEqual([]);
    expect(await queue.failed()).toEqual([]);
  });
});

describe('flushQueue', () => {
  let queue: SyncQueue;

  beforeEach(async () => {
    queue = new SyncQueue(createMemoryStore());
    await queue.enqueueUpsert(USER, log('a'), true, false);
    await queue.enqueueUpsert(USER, log('b'), true, false);
    await queue.enqueueUpsert('other-user', log('c'), true, false);
  });

  it('sends the user\'s operations in order and removes them', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await flushQueue(queue, USER, send)).toEqual({ status: 'done', failed: 0 });
    expect(send.mock.calls.map((call) => (call[0] as SyncOperation).entityId)).toEqual(['a', 'b']);
    // Another account's entries are never sent with this session.
    expect((await queue.all()).map((entry) => entry.entityId)).toEqual(['c']);
  });

  it('stops on network errors, 5xx and 429, counting an attempt', async () => {
    for (const error of [new NetworkError(), new ApiError(503, 'X', 'x'), new ApiError(429, 'RATE_LIMITED', 'x')]) {
      const send = vi.fn().mockRejectedValue(error);
      expect((await flushQueue(queue, USER, send)).status).toBe('retry');
      expect(send).toHaveBeenCalledOnce();
    }
    expect((await queue.all())[0]?.attempts).toBe(3);
  });

  it('moves 4xx refusals to the dead-letter list and goes on', async () => {
    const send = vi.fn().mockRejectedValueOnce(new ApiError(409, 'EVENT_ID_CONFLICT', 'x')).mockResolvedValueOnce(undefined);
    expect(await flushQueue(queue, USER, send)).toEqual({ status: 'done', failed: 1 });
    expect((await queue.failed())[0]).toMatchObject({ status: 409, code: 'EVENT_ID_CONFLICT' });
  });

  it('waits for a new session on 401 without counting an attempt', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(401, 'UNAUTHORIZED', 'x'));
    expect((await flushQueue(queue, USER, send)).status).toBe('unauthorized');
    expect((await queue.all()).filter((entry) => entry.payload.userId === USER).map((entry) => entry.attempts)).toEqual([0, 0]);
  });
});

describe('applyPendingOperations', () => {
  it('shows queued creations and edits and hides queued deletes', async () => {
    const queue = new SyncQueue(createMemoryStore());
    await queue.enqueueUpsert(USER, log('new'), true, true);
    await queue.enqueueUpsert(USER, log('edited', { notes: 'nuevo' }), false, true);
    await queue.enqueueDelete(USER, CALENDAR, 'gone');
    await queue.enqueueUpsert('other-user', log('foreign'), true, true);
    const range = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' };

    const result = applyPendingOperations([log('edited'), log('gone'), log('kept')], await queue.all(), USER, CALENDAR, range);

    expect(result.map((entry) => entry.id).sort()).toEqual(['edited', 'kept', 'new']);
    expect(result.find((entry) => entry.id === 'edited')?.notes).toBe('nuevo');
  });
});

describe('OfflineCache', () => {
  it('belongs to one user and replaces logs inside the fetched range only', async () => {
    const store = createMemoryStore();
    const cache = new OfflineCache(store, USER);
    await cache.putLogs(CALENDAR, { from: '2026-09-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' }, [log('sep', { loggedAt: '2026-09-10T00:00:00.000Z' }), log('oct')]);
    await cache.putLogs(CALENDAR, { from: '2026-10-01T00:00:00.000Z', to: '2026-10-31T00:00:00.000Z' }, [log('oct2')]);
    expect((await cache.logs(CALENDAR)).map((entry) => entry.id).sort()).toEqual(['oct2', 'sep']);
    expect(await new OfflineCache(store, 'other-user').logs(CALENDAR)).toEqual([]);
  });
});
