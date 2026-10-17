import { DomainRuleError, GUEST_LOCKED_WARNING, isGuestItemLimitReached } from '@cuidat/shared';
import type { HealthItemDefinition, ItemDraft, ItemEditPatch } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sanitizeText } from '../sanitizeText';
import { currentRepositories } from './currentRepositories';
import { useAuthStore } from './useAuthStore';
import { useEventStore } from './useEventStore';
import { useProfileStore } from './useProfileStore';

/** Catalog of the active calendar: every version of every lineage. */
export const useItemDefinitionStore = defineStore('itemDefinitions', () => {
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const eventStore = useEventStore();

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
    items.value = await currentRepositories().items.list(calendarId);
  }

  /** Replaces the versions of one lineage with the result of a catalog command. */
  function replaceLineage(rootId: string, lineage: readonly HealthItemDefinition[]): void {
    items.value = [...items.value.filter((item) => item.rootId !== rootId), ...lineage];
  }

  /** The sample catalog: seeded on the first guest load; «Añadir ítems de ejemplo» for accounts. */
  async function addPresetItems(calendarId: string): Promise<void> {
    const presets = await currentRepositories().items.addPresets(calendarId);
    if (calendarId === profileStore.activeProfileId) {
      items.value = [...items.value, ...presets];
    }
  }

  async function createItem(draft: ItemDraft): Promise<HealthItemDefinition> {
    const calendarId = profileStore.activeProfileId;
    if (authStore.isGuest && isGuestItemLimitReached(items.value, calendarId, draft.category)) {
      throw new DomainRuleError('GUEST_LIMIT', GUEST_LOCKED_WARNING);
    }
    const item = await currentRepositories().items.create(calendarId, {
      ...draft,
      name: sanitizeText(draft.name),
      emoji: sanitizeText(draft.emoji),
    });
    items.value = [...items.value, item];
    return item;
  }

  /** Name and emoji apply to the whole lineage; tracking changes create a new version (ADR-006). */
  async function editItemLineage(rootId: string, patch: ItemEditPatch): Promise<void> {
    const cleanPatch: ItemEditPatch = {
      ...patch,
      name: patch.name === undefined ? undefined : sanitizeText(patch.name),
      emoji: patch.emoji === undefined ? undefined : sanitizeText(patch.emoji),
    };
    replaceLineage(rootId, await currentRepositories().items.edit(profileStore.activeProfileId, rootId, cleanPatch));
  }

  async function archiveItemLineage(rootId: string): Promise<void> {
    replaceLineage(rootId, await currentRepositories().items.archive(profileStore.activeProfileId, rootId));
  }

  async function restoreItemLineage(rootId: string): Promise<void> {
    replaceLineage(rootId, await currentRepositories().items.restore(profileStore.activeProfileId, rootId));
  }

  /** Number of logs a permanent deletion would erase (shown before the user accepts). */
  async function getDeleteImpact(rootId: string): Promise<number> {
    return currentRepositories().items.deleteImpact(profileStore.activeProfileId, rootId);
  }

  async function deleteItemLineage(rootId: string): Promise<void> {
    const calendarId = profileStore.activeProfileId;
    const versionIds = new Set(items.value.filter((item) => item.rootId === rootId).map((item) => item.id));
    await currentRepositories().items.removeLineage(calendarId, rootId);
    items.value = items.value.filter((item) => item.rootId !== rootId);
    // The cascade also took the logs of every version.
    eventStore.logs = eventStore.logs.filter((log) => !versionIds.has(log.itemDefinitionId));
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
