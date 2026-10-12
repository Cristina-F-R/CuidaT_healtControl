import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import { loadWorkspace } from '../composables/useWorkspace';
import { useEventStore } from './useEventStore';
import { useItemDefinitionStore } from './useItemDefinitionStore';
import { useProfileStore } from './useProfileStore';

/** Runs `action` and returns the DomainRuleError code it throws, or `'none'`. */
async function ruleCodeOf(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return 'none';
  } catch (error) {
    return error instanceof Error && 'code' in error ? String(error.code) : 'unexpected';
  }
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe('guest workspace (local repositories)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('seeds the guest profile and the preset catalog on the first load only', async () => {
    await loadWorkspace();
    const profiles = useProfileStore();
    const items = useItemDefinitionStore();

    expect(profiles.profiles).toHaveLength(1);
    expect(profiles.activeProfile.name).toBe('Moby');
    expect(items.activeItems).toHaveLength(6);
    expect(items.symptoms).toHaveLength(3);

    // A new session reads the stored data and does not seed again.
    setActivePinia(createPinia());
    await loadWorkspace();
    expect(useItemDefinitionStore().items).toHaveLength(6);
    expect(useProfileStore().profiles).toHaveLength(1);
  });

  it('keeps the guest document under the @cuidat_guest_v1 key', async () => {
    await loadWorkspace();
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
  });

  it('limits a guest to 3 symptoms and 3 triggers/medication, and archived items keep their slot', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();

    // The presets already fill both groups (3 symptoms, 3 triggers/medication).
    expect(await ruleCodeOf(() => items.createItem({ name: 'Tos', emoji: '😷', category: 'symptom', trackIntensity: true, trackDuration: false }))).toBe('GUEST_LIMIT');
    expect(await ruleCodeOf(() => items.createItem({ name: 'Huevo', emoji: '🥚', category: 'trigger', trackIntensity: false, trackDuration: false }))).toBe('GUEST_LIMIT');

    const vomit = items.items.find((item) => item.name === 'Vómito');
    expect(vomit).toBeDefined();
    await items.archiveItemLineage(vomit!.rootId);
    expect(await ruleCodeOf(() => items.createItem({ name: 'Tos', emoji: '😷', category: 'symptom', trackIntensity: true, trackDuration: false }))).toBe('GUEST_LIMIT');

    // Permanent deletion frees the slot.
    await items.deleteItemLineage(vomit!.rootId);
    expect(await ruleCodeOf(() => items.createItem({ name: 'Tos', emoji: '😷', category: 'symptom', trackIntensity: true, trackDuration: false }))).toBe('none');
  });

  it('allows only one calendar profile for a guest', async () => {
    await loadWorkspace();
    const profiles = useProfileStore();
    expect(
      await ruleCodeOf(() =>
        profiles.createProfile({ name: 'Luna', profileType: 'Mascota', correlationWindowHours: 12 }),
      ),
    ).toBe('GUEST_LIMIT');
  });

  it('versions the item when the tracking shape changes and keeps the old logs on the old version', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const events = useEventStore();
    const calendarId = useProfileStore().activeProfileId;
    const medication = items.items.find((item) => item.name === 'Medicación')!;

    const log = await events.saveLog({
      existing: null,
      calendarId,
      item: medication,
      loggedAt: hoursAgo(2),
      intensity: null,
      durationMinutes: null,
      notes: '',
    });

    await items.editItemLineage(medication.rootId, { trackDuration: true });
    const live = items.findLiveByRoot(medication.rootId);
    expect(live?.id).not.toBe(medication.id);
    expect(live?.parentId).toBe(medication.id);
    expect(items.findById(medication.id)?.status).toBe('superseded');
    expect(events.logs.find((entry) => entry.id === log.id)?.itemDefinitionId).toBe(medication.id);
  });

  it('renames every version of a lineage in place', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const vomit = items.items.find((item) => item.name === 'Vómito')!;
    await items.editItemLineage(vomit.rootId, { trackDuration: true });
    await items.editItemLineage(vomit.rootId, { name: 'Náusea' });

    const names = items.items.filter((item) => item.rootId === vomit.rootId).map((item) => item.name);
    expect(names).toEqual(['Náusea', 'Náusea']);
  });

  it('rejects the category change and logs on archived items', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const events = useEventStore();
    const calendarId = useProfileStore().activeProfileId;
    const vomit = items.items.find((item) => item.name === 'Vómito')!;

    expect(await ruleCodeOf(() => items.editItemLineage(vomit.rootId, { category: 'trigger' }))).toBe('CATEGORY_LOCKED');

    await items.archiveItemLineage(vomit.rootId);
    const archived = items.findLiveByRoot(vomit.rootId)!;
    const draft = {
      existing: null,
      calendarId,
      item: archived,
      loggedAt: hoursAgo(1),
      intensity: 1 as const,
      durationMinutes: null,
      notes: '',
    };
    expect(await ruleCodeOf(() => events.saveLog(draft))).toBe('ITEM_NOT_ACTIVE');
  });

  it('refuses future logs and metrics that the item does not track', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const events = useEventStore();
    const calendarId = useProfileStore().activeProfileId;
    const vomit = items.items.find((item) => item.name === 'Vómito')!;
    const fish = items.items.find((item) => item.name === 'Pescado')!;

    const future = new Date(Date.now() + 24 * 3_600_000).toISOString();
    expect(
      await ruleCodeOf(() =>
        events.saveLog({ existing: null, calendarId, item: vomit, loggedAt: future, intensity: 2, durationMinutes: null, notes: '' }),
      ),
    ).toBe('FUTURE_DATE');
    expect(
      await ruleCodeOf(() =>
        events.saveLog({ existing: null, calendarId, item: fish, loggedAt: hoursAgo(1), intensity: 2, durationMinutes: null, notes: '' }),
      ),
    ).toBe('INVALID_INPUT');
  });

  it('sanitizes names and notes before storing them', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const events = useEventStore();
    const calendarId = useProfileStore().activeProfileId;

    const fish = items.items.find((item) => item.name === 'Pescado')!;
    const log = await events.saveLog({
      existing: null,
      calendarId,
      item: fish,
      loggedAt: hoursAgo(1),
      intensity: null,
      durationMinutes: null,
      notes: '  <b>Mucho</b> <script>x</script>  ',
    });
    expect(log.notes).toBe('Mucho');

    // Deleting a preset frees a symptom slot for the guest (TECH_SPEC.md use case 4).
    const vomit = items.items.find((item) => item.name === 'Vómito')!;
    await items.deleteItemLineage(vomit.rootId);
    const created = await items.createItem({
      name: '<img src=x onerror=alert(1)>Tos & fiebre',
      emoji: '😷',
      category: 'symptom',
      trackIntensity: true,
      trackDuration: false,
    });
    expect(created.name).not.toContain('<img');
    expect(created.name).toContain('Tos & fiebre');
  });

  it('persists logs in the guest document and removes them with their item', async () => {
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const events = useEventStore();
    const calendarId = useProfileStore().activeProfileId;
    const vomit = items.items.find((item) => item.name === 'Vómito')!;

    const log = await events.saveLog({
      existing: null,
      calendarId,
      item: vomit,
      loggedAt: hoursAgo(3),
      intensity: 2,
      durationMinutes: null,
      notes: 'Tras comer',
    });
    const edited = await events.saveLog({
      existing: log,
      calendarId,
      item: vomit,
      loggedAt: log.loggedAt,
      intensity: 1,
      durationMinutes: null,
      notes: 'Editado',
    });
    expect(edited.id).toBe(log.id);
    expect(events.logs.find((entry) => entry.id === log.id)?.notes).toBe('Editado');

    await items.deleteItemLineage(vomit.rootId);
    expect(events.logs.find((entry) => entry.id === log.id)).toBeUndefined();
  });
});
