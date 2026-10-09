import { createPresetItems } from '@cuidat/shared';
import type { HealthItemDefinition } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useProfileStore } from './useProfileStore';

export const useItemDefinitionStore = defineStore('itemDefinitions', () => {
  const profileStore = useProfileStore();

  // Phase 1: the guest profile starts with the sample catalog, kept in memory.
  const items = ref<HealthItemDefinition[]>(
    createPresetItems(profileStore.activeProfileId, () => crypto.randomUUID()),
  );

  const activeItems = computed(() =>
    items.value.filter((item) => item.calendarId === profileStore.activeProfileId && item.status === 'active'),
  );
  const symptoms = computed(() => activeItems.value.filter((item) => item.category === 'symptom'));
  const triggersAndMedication = computed(() => activeItems.value.filter((item) => item.category !== 'symptom'));

  function findById(id: string): HealthItemDefinition | undefined {
    return items.value.find((item) => item.id === id);
  }

  function resetState(): void {
    items.value = createPresetItems(profileStore.activeProfileId, () => crypto.randomUUID());
  }

  return { items, activeItems, symptoms, triggersAndMedication, findById, resetState };
});
