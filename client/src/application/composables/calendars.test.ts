import { GUEST_LOCKED_WARNING } from '@cuidat/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { callsOf } from '../../testing/fakeApi';
import { createFakeServer } from '../../testing/fakeServer';
import { useAuthStore } from '../stores/useAuthStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { completeOnboarding, createCalendar, deleteCalendar, loadWorkspace, switchCalendar, useNeedsOnboarding } from './useWorkspace';

describe('calendar lifecycle (TECH_SPEC.md use case 6)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('edits the guest calendar in place and validates the same rules as a new one', async () => {
    await loadWorkspace();
    const store = useProfileStore();

    await store.updateProfile(store.activeProfileId, { name: '  Rex  ', correlationWindowHours: 12 });

    expect(store.activeProfile).toMatchObject({ name: 'Rex', profileType: 'Mascota', avatarIcon: '🐶', correlationWindowHours: 12 });
    await expect(store.updateProfile(store.activeProfileId, { profileType: '   ' })).rejects.toThrow(/entre 1 y 50/);
    // Persisted in the guest document.
    setActivePinia(createPinia());
    await loadWorkspace();
    expect(useProfileStore().activeProfile.name).toBe('Rex');
  });

  it('keeps guests at one calendar and refuses to delete the last one', async () => {
    await loadWorkspace();
    const store = useProfileStore();

    await expect(store.createProfile({ name: 'Otro', profileType: 'Mascota' })).rejects.toThrow(GUEST_LOCKED_WARNING);
    expect(store.canDeleteProfile).toBe(false);
    await expect(deleteCalendar(store.activeProfileId)).rejects.toThrow('No se puede eliminar el último calendario.');
  });

  it('shows the onboarding for an account without calendars and opens the workspace after it', async () => {
    const server = createFakeServer(true);
    server.profiles = [];
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();

    await loadWorkspace();
    expect(useNeedsOnboarding().value).toBe(true);
    // Nothing is created behind the user's back, and no catalog is requested.
    expect(callsOf(server.fetch)).toEqual(['GET /api/auth/me', 'GET /api/profiles']);

    await completeOnboarding({ name: 'Ana', profileType: 'Adulto' });

    expect(useNeedsOnboarding().value).toBe(false);
    expect(server.profiles).toHaveLength(1);
    expect(server.profiles[0]).toMatchObject({ name: 'Ana', profileType: 'Adulto', avatarIcon: '👤', correlationWindowHours: 48 });
    expect(useProfileStore().activeProfile.name).toBe('Ana');
    // The new calendar starts empty: the dock offers «Añadir ítems de ejemplo».
    expect(useItemDefinitionStore().items).toEqual([]);
  });

  it('does not show the onboarding when the account already has a calendar', async () => {
    const server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();

    await loadWorkspace();

    expect(useNeedsOnboarding().value).toBe(false);
  });

  it('adds the sample items to an empty calendar of an account', async () => {
    const server = createFakeServer(true);
    server.profiles = [];
    server.items.length = 0;
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    await completeOnboarding({ name: 'Ana', profileType: 'Adulto' });

    await useItemDefinitionStore().addPresetItems(useProfileStore().activeProfileId);

    expect(useItemDefinitionStore().activeItems.map((item) => item.name)).toEqual([
      'Vómito', 'Heces blandas', 'Malestar / dolor', 'Pescado', 'Lácteos', 'Medicación',
    ]);
  });

  it('creates, switches, edits and deletes calendars of an account', async () => {
    const server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    const store = useProfileStore();
    const luna = store.activeProfileId;

    await createCalendar({ name: 'Leo', profileType: 'Niño/a', correlationWindowHours: 6 });
    const leo = store.activeProfileId;
    expect(leo).not.toBe(luna);
    expect(store.canDeleteProfile).toBe(true);
    expect([...store.profileTypes].sort()).toEqual(['Mascota', 'Niño/a']);
    // Leo has no catalog yet; Luna keeps hers.
    expect(useItemDefinitionStore().items).toEqual([]);
    await switchCalendar(luna);
    expect(store.activeProfileId).toBe(luna);
    expect(useItemDefinitionStore().items).toHaveLength(6);

    await store.updateProfile(luna, { profileType: 'Gata' });
    expect(server.profiles[0]?.profileType).toBe('Gata');
    expect(store.activeProfile.profileType).toBe('Gata');

    // Deleting the active calendar shows the one that is left.
    await deleteCalendar(luna);
    expect(store.activeProfileId).toBe(leo);
    expect(store.profiles.map((profile) => profile.name)).toEqual(['Leo']);
    expect(store.canDeleteProfile).toBe(false);
  });
});
