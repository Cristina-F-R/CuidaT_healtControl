import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { jsonResponse } from '../../testing/fakeApi';
import { createFakeServer } from '../../testing/fakeServer';
import type { FakeServer } from '../../testing/fakeServer';
import { loadWorkspace } from '../composables/useWorkspace';
import { userMessageOf } from '../errors';
import { useAuthStore } from './useAuthStore';
import { useEventStore } from './useEventStore';
import { useItemDefinitionStore } from './useItemDefinitionStore';

describe('registered user data (API repositories)', () => {
  let server: FakeServer;

  beforeEach(async () => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads three months first and fetches an older month on demand', async () => {
    const old = dayjs().subtract(6, 'month').startOf('month').add(10, 'day').toISOString();
    server.logs.set('55555555-5555-4555-8555-555555555555', {
      id: '55555555-5555-4555-8555-555555555555', calendarId: server.profile.id, itemDefinitionId: server.items[0]!.id,
      loggedAt: old, intensity: 2, durationMinutes: null, notes: null, createdAt: old, updatedAt: old,
    });
    await loadWorkspace();
    const eventStore = useEventStore();
    expect(eventStore.logs).toEqual([]);
    const firstFrom = server.fetch.mock.calls.map(([input]) => new URL(input, 'http://localhost')).find((url) => url.pathname.endsWith('/events'))?.searchParams.get('from');
    // The current month, the two before it and the widest correlation window (48 h).
    expect(firstFrom).toBe(dayjs().subtract(2, 'month').startOf('month').subtract(48, 'hour').toISOString());

    await eventStore.ensureMonthLoaded(server.profile.id, dayjs(old).format('YYYY-MM'));
    expect(eventStore.logs.map((log) => log.loggedAt)).toEqual([old]);
  });

  it('applies catalog commands through the API and keeps the whole lineage', async () => {
    await loadWorkspace();
    const itemStore = useItemDefinitionStore();
    const vomit = server.items[0]!;
    server.fetch.mockResolvedValueOnce(jsonResponse(200, { items: [{ ...vomit, status: 'archived' }] }));

    await itemStore.archiveItemLineage(vomit.rootId);

    expect(server.fetch.mock.calls.at(-1)?.[0]).toMatch(new RegExp(`/api/profiles/${server.profile.id}/items/${vomit.rootId}/archive$`));
    expect(itemStore.findById(vomit.id)?.status).toBe('archived');
    expect(itemStore.activeItems).toHaveLength(5);
  });

  it('needs connection for catalog changes, with a message for the user', async () => {
    await loadWorkspace();
    server.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const error: unknown = await useItemDefinitionStore()
      .createItem({ name: 'Gluten', emoji: '🌾', category: 'trigger', trackIntensity: false, trackDuration: false })
      .catch((caught: unknown) => caught);

    expect(userMessageOf(error)).toContain('necesita conexión');
  });

  it('opens from the offline cache when the API cannot be reached', async () => {
    await loadWorkspace();
    setActivePinia(createPinia());
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    useAuthStore().$patch({ user: { id: '7d4f3c1e-2b6a-4f7e-9a1c-3e5b8d2f6a90', email: 'ana@example.com' } });

    await loadWorkspace();

    expect(useItemDefinitionStore().items).toHaveLength(6);
  });
});
