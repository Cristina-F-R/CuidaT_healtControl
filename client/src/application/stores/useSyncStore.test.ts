import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { callsOf } from '../../testing/fakeApi';
import { createFakeServer } from '../../testing/fakeServer';
import type { FakeServer } from '../../testing/fakeServer';
import { syncBadge } from '../composables/useSyncStatus';
import { loadWorkspace } from '../composables/useWorkspace';
import { useAuthStore } from './useAuthStore';
import { useEventStore } from './useEventStore';
import { RETRY_MAX_MS, RETRY_MIN_MS, useSyncStore } from './useSyncStore';

function setOnline(value: boolean): void {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

async function settle(): Promise<void> {
  for (let round = 0; round < 10; round += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('useSyncStore (ADR-007)', () => {
  let server: FakeServer;

  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    useSyncStore().start();
    await settle();
  });

  afterEach(() => {
    useSyncStore().stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function badge(): string {
    const sync = useSyncStore();
    return syncBadge(useAuthStore().isGuest, sync.online, sync.pendingCount).label;
  }

  async function logSomething(notes = ''): Promise<void> {
    await useEventStore().saveLog({
      existing: null, calendarId: server.profile.id, item: server.items[0]!, loggedAt: new Date(Date.now() - 60_000).toISOString(),
      intensity: 1, durationMinutes: null, notes,
    });
    await settle();
  }

  it('sends a change right away when online', async () => {
    await logSomething('al momento');
    expect(server.logs.size).toBe(1);
    expect(badge()).toBe('Sincronizado');
  });

  it('keeps changes made offline, shows «Sin conexión» and sends them on the online event', async () => {
    setOnline(false);
    await logSomething('sin red');
    await logSomething('otra');
    expect(badge()).toBe('Sin conexión');
    expect(useSyncStore().pendingCount).toBe(2);
    expect(server.logs.size).toBe(0);
    // The calendar shows them anyway.
    expect(useEventStore().logs).toHaveLength(2);

    setOnline(true);
    await settle();
    expect(server.logs.size).toBe(2);
    expect(badge()).toBe('Sincronizado');
    // Queued without connection: sent as deferred, so an archived item does not reject them.
    const put = server.fetch.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toMatchObject({ deferred: true, notes: 'sin red' });
  });

  it('retries with exponential backoff from 5 s up to 5 min after server errors', async () => {
    vi.useFakeTimers();
    server.eventWriteStatus = 503;
    await useEventStore().saveLog({
      existing: null, calendarId: server.profile.id, item: server.items[0]!, loggedAt: new Date(Date.now() - 60_000).toISOString(),
      intensity: 1, durationMinutes: null, notes: '',
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(badge()).toBe('Pendiente (1)');

    const puts = (): number => callsOf(server.fetch).filter((call) => call.startsWith('PUT')).length;
    const first = puts();
    await vi.advanceTimersByTimeAsync(RETRY_MIN_MS - 1);
    expect(puts()).toBe(first);
    await vi.advanceTimersByTimeAsync(1);
    expect(puts()).toBe(first + 1);
    await vi.advanceTimersByTimeAsync(RETRY_MIN_MS * 2);
    expect(puts()).toBe(first + 2);
    // The delay doubles but never exceeds five minutes.
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS * 3);
    const capped = puts();
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS);
    expect(puts()).toBe(capped + 1);

    server.eventWriteStatus = null;
    await vi.advanceTimersByTimeAsync(RETRY_MAX_MS);
    expect(badge()).toBe('Sincronizado');
  });

  it('moves refused logs to the failures and warns the user', async () => {
    server.eventWriteStatus = 400;
    await logSomething('rechazado');
    expect(useSyncStore().pendingCount).toBe(0);
    expect(useSyncStore().failedCount).toBe(1);
    await useSyncStore().dismissFailures();
    expect(useSyncStore().failedCount).toBe(0);
  });

  it('flushes when the tab becomes visible', async () => {
    setOnline(false);
    await logSomething();
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    useSyncStore().online = true;
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(server.logs.size).toBe(1);
  });
});
