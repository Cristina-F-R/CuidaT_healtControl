import { DomainRuleError } from '@cuidat/shared';
import type { ItemCategory } from '@cuidat/shared';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useGuestLimits } from './useGuestLimits';

export interface ItemForm {
  isEdit: boolean;
  name: Ref<string>;
  emoji: Ref<string>;
  category: Ref<ItemCategory>;
  trackIntensity: Ref<boolean>;
  trackDuration: Ref<boolean>;
  errorMessage: Ref<string>;
  save: () => Promise<boolean>;
}

/** Create (rootId = null) or edit a catalog item. The category is locked when editing (ADR-006). */
export function useItemForm(rootId: string | null): ItemForm {
  const itemStore = useItemDefinitionStore();
  const guestLimits = useGuestLimits();
  const current = rootId === null ? undefined : itemStore.findLiveByRoot(rootId);

  const name = ref(current?.name ?? '');
  const emoji = ref(current?.emoji ?? '🩺');
  const category = ref<ItemCategory>(current?.category ?? 'symptom');
  const trackIntensity = ref(current?.trackIntensity ?? true);
  const trackDuration = ref(current?.trackDuration ?? false);
  const errorMessage = ref('');

  async function save(): Promise<boolean> {
    errorMessage.value = '';
    const values = {
      name: name.value,
      emoji: emoji.value,
      trackIntensity: trackIntensity.value,
      trackDuration: trackDuration.value,
    };
    try {
      if (rootId === null) {
        await itemStore.createItem({ ...values, category: category.value });
      } else {
        await itemStore.editItemLineage(rootId, values);
      }
      return true;
    } catch (error) {
      if (error instanceof DomainRuleError && error.code !== 'GUEST_LIMIT') {
        errorMessage.value = error.message;
        return false;
      }
      guestLimits.handleStoreError(error);
      return false;
    }
  }

  return {
    isEdit: rootId !== null,
    name,
    emoji,
    category,
    trackIntensity,
    trackDuration,
    errorMessage,
    save,
  };
}
