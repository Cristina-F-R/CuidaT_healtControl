import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../../infrastructure/http/apiClient';
import { downloadJson } from '../../infrastructure/download';
import { getSyncQueue, resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import type { KeyValueStore } from '../../infrastructure/sync/keyValueStore';
import { OFFLINE_CACHE_KEY } from '../../infrastructure/sync/OfflineCache';
import { jsonResponse } from '../../testing/fakeApi';
import { createFakeServer, TEST_USER } from '../../testing/fakeServer';
import { PendingChangesError } from '../errors';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { buildUserDataExport, deletionFailureMessage, useAccount } from './useAccount';
import { loadWorkspace } from './useWorkspace';

const BACKUP_KEY = `${GUEST_STORAGE_KEY}.corrupto`;
const CREDENTIALS = { email: TEST_USER.email, password: 'una contraseña larga' };

describe('account actions (sessions, GDPR Art. 17 and 20)', () => {
  let store: KeyValueStore;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    store = createMemoryStore();
    resetDataLayerForTests(store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('exports the guest calendar with its items and logs', async () => {
    await loadWorkspace();

    const data = await buildUserDataExport(new Date('2026-10-17T10:00:00.000Z'));

    expect(data).toMatchObject({ format: 'cuidat-export', version: 1, exportedAt: '2026-10-17T10:00:00.000Z', account: null });
    expect(data.calendars).toHaveLength(1);
    expect(data.calendars[0]?.name).toBe('Moby');
    expect(data.calendars[0]?.items).toHaveLength(6);
  });

  it('signs in, loads the account from the API and exports its whole history', async () => {
    const server = createFakeServer();
    const old = { id: '33333333-3333-4333-8333-333333333333', calendarId: server.profile.id, itemDefinitionId: server.items[0]!.id, loggedAt: '2025-01-10T09:00:00.000Z', intensity: 1 as const, durationMinutes: null, notes: null, createdAt: '2025-01-10T09:00:00.000Z', updatedAt: '2025-01-10T09:00:00.000Z' };
    server.logs.set(old.id, old);
    vi.stubGlobal('fetch', server.fetch);
    await loadWorkspace();

    await useAccount().signIn(CREDENTIALS);

    expect(useProfileStore().activeProfile.name).toBe('Luna');
    expect(useItemDefinitionStore().items).toHaveLength(6);
    // The calendar shows the last months only; the export covers everything.
    expect(useEventStore().logs).toEqual([]);
    const data = await buildUserDataExport();
    expect(data.account).toEqual(TEST_USER);
    expect(data.calendars[0]?.logs).toEqual([old]);
  });

  it('downloads the JSON through a Blob URL and revokes it right away', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cuidat');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadJson('datos.json', { a: 1 });

    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:cuidat');
  });

  it('refuses to sign out while logs wait to be synced, and wipes the offline copy when it does', async () => {
    const server = createFakeServer();
    vi.stubGlobal('fetch', server.fetch);
    await loadWorkspace();
    await useAccount().signIn(CREDENTIALS);
    expect(await store.getItem(OFFLINE_CACHE_KEY)).not.toBeNull();

    // A log that the server keeps refusing with 503 stays in the queue.
    server.eventWriteStatus = 503;
    await useEventStore().saveLog({
      existing: null, calendarId: server.profile.id, item: server.items[0]!, loggedAt: new Date(Date.now() - 60_000).toISOString(),
      intensity: 2, durationMinutes: null, notes: '',
    });
    await expect(useAccount().signOut()).rejects.toBeInstanceOf(PendingChangesError);
    expect(useAuthStore().isSignedIn).toBe(true);

    server.eventWriteStatus = null;
    await useAccount().signOut();
    expect(server.logs.size).toBe(1);
    expect(useAuthStore().isSignedIn).toBe(false);
    expect(await store.getItem(OFFLINE_CACHE_KEY)).toBeNull();
    expect(useProfileStore().activeProfile.name).toBe('Moby');
  });

  it('after deleting the account, wipes the queue, the offline copy and the guest data', async () => {
    const server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    localStorage.setItem(BACKUP_KEY, '{roto');
    await useAuthStore().restoreSession();
    await loadWorkspace();
    await getSyncQueue().enqueueDelete(TEST_USER.id, server.profile.id, '44444444-4444-4444-8444-444444444444');
    server.fetch.mockImplementationOnce(async () => new Response(null, { status: 204 }));

    await useAccount().deleteAccountAndData();

    expect(useAuthStore().user).toBeNull();
    expect(await getSyncQueue().all()).toEqual([]);
    expect(await store.getItem(OFFLINE_CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
    // A fresh guest calendar.
    expect(useProfileStore().profiles).toHaveLength(1);
    expect(useProfileStore().activeProfile.name).toBe('Moby');
  });

  it('keeps everything when the server refuses the deletion', async () => {
    const server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    server.fetch.mockResolvedValueOnce(jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } }));

    await expect(useAccount().deleteAccountAndData()).rejects.toBeInstanceOf(ApiError);

    expect(useAuthStore().user).toEqual(TEST_USER);
    expect(await store.getItem(OFFLINE_CACHE_KEY)).not.toBeNull();
  });

  it('explains API and network failures and rethrows anything else', () => {
    expect(deletionFailureMessage(new NetworkError())).toContain('Tu cuenta sigue activa');
    expect(deletionFailureMessage(new ApiError(500, 'INTERNAL_ERROR', 'x'))).toContain('No se pudo eliminar');
    expect(() => deletionFailureMessage(new TypeError('bug'))).toThrow('bug');
  });
});
