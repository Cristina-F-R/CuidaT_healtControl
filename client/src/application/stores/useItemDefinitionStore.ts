import {
  archiveItem,
  countLineageLogs,
  createItemDefinition,
  createPresetItems,
  DomainRuleError,
  editItem,
  GUEST_LOCKED_WARNING,
  isGuestItemLimitReached,
  restoreItem,
} from '@cuidat/shared';
import type { HealthItemDefinition, ItemDraft, ItemEditPatch } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createRepositories } from '../../infrastructure/repositories/createRepositories';
import { sanitizeText } from '../sanitizeText';
import { useAuthStore } from './useAuthStore';
import { useEventStore } from './useEventStore';
import { useProfileStore } from './useProfileStore';

/** Catalog of the active calendar: every version of every lineage. */
export const useItemDefinitionStore = defineStore('itemDefinitions', () => {
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const eventStore = useEventStore();
  const repositories = createRepositories(authStore.authMode);

  const items = ref<HealthItemDefinition[]>([]);

  const activeItems = computed(() => items.value.filter((item) => item.status === 'active'));
  const archivedItems = computed(() => items.value.filter((item) => item.status === 'archived'));
  const symptoms = computed(() => activeItems.value.filter((item) => item.category === 'symptom'));
  const triggersAndMedication = computed(() => activeItems.value.filter((item) => item.category !== 'symptom'));

  function findById(id: string): HealthItemDefinition | undefined {
    return items.value.find((item) => item.id === id);
  }

  /** Live version of a lineage (the one a new log attaches to), or `undefined`. */
  function findLiveByRoot(rootId: string): HealthItemDefinition | undefined {
    return items.value.find((item) => item.rootId === rootId && item.status !== 'superseded');
  }

  async function loadItems(calendarId: string): Promise<void> {
    items.value = await repositories.items.list(calendarId);
  }

  /** First guest load: the sample catalog (TECH_SPEC.md section 1, presets). */
  async function addPresetItems(calendarId: string): Promise<void> {
    await repositories.items.save(createPresetItems(calendarId, () => crypto.randomUUID(), new Date()));
  }

  async function persist(next: readonly HealthItemDefinition[]): Promise<void> {
    await repositories.items.save(next);
    items.value = [...next];
  }

  async function createItem(draft: ItemDraft): Promise<HealthItemDefinition> {
    const calendarId = profileStore.activeProfileId;
    if (authStore.isGuest && isGuestItemLimitReached(items.value, calendarId, draft.category)) {
      throw new DomainRuleError('GUEST_LIMIT', GUEST_LOCKED_WARNING);
    }
    const item = createItemDefinition(
      calendarId,
      { ...draft, name: sanitizeText(draft.name), emoji: sanitizeText(draft.emoji) },
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    await persist([...items.value, item]);
    return item;
  }

  /** Name and emoji apply to the whole lineage; tracking changes create a new version (ADR-006). */
  async function editItemLineage(rootId: string, patch: ItemEditPatch): Promise<void> {
    const cleanPatch: ItemEditPatch = {
      ...patch,
      name: patch.name === undefined ? undefined : sanitizeText(patch.name),
      emoji: patch.emoji === undefined ? undefined : sanitizeText(patch.emoji),
    };
    await persist(
      editItem(items.value, rootId, cleanPatch, { newId: crypto.randomUUID(), now: new Date().toISOString() }),
    );
  }

  async function archiveItemLineage(rootId: string): Promise<void> {
    await persist(archiveItem(items.value, rootId));
  }

  async function restoreItemLineage(rootId: string): Promise<void> {
    await persist(restoreItem(items.value, rootId));
  }

  /** Number of logs a permanent deletion would erase (shown before the user accepts). */
  async function getDeleteImpact(rootId: string): Promise<number> {
    const logs = await repositories.events.list(profileStore.activeProfileId);
    return countLineageLogs(items.value, logs, rootId);
  }

  async function deleteItemLineage(rootId: string): Promise<void> {
    const calendarId = profileStore.activeProfileId;
    await repositories.items.removeLineage(calendarId, rootId);
    await loadItems(calendarId);
    await eventStore.loadLogs(calendarId);
  }

  function resetState(): void {
    items.value = [];
  }

  return {
    items,
    activeItems,
    archivedItems,
    symptoms,
    triggersAndMedication,
    findById,
    findLiveByRoot,
    loadItems,
    addPresetItems,
    createItem,
    editItemLineage,
    archiveItemLineage,
    restoreItemLineage,
    getDeleteImpact,
    deleteItemLineage,
    resetState,
  };
});
