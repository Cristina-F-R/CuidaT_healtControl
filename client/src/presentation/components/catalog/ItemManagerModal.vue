<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';
import CatalogItemList from './CatalogItemList.vue';
import ItemFormPanel from './ItemFormPanel.vue';
import ItemLifecycleActions from './ItemLifecycleActions.vue';

type CatalogView = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; rootId: string };

const { closeOverlay } = useOverlays();
const itemStore = useItemDefinitionStore();
const { symptoms, triggersAndMedication, archivedItems } = storeToRefs(itemStore);

const view = ref<CatalogView>({ kind: 'list' });
const backToList = (): void => {
  view.value = { kind: 'list' };
};
function openItem(rootId: string): void {
  view.value = { kind: 'edit', rootId };
}
const editingArchived = computed(() => {
  if (view.value.kind !== 'edit') {
    return false;
  }
  return itemStore.findLiveByRoot(view.value.rootId)?.status === 'archived';
});
</script>

<template>
  <AppModal
    title="Gestionar ítems"
    @close="closeOverlay"
  >
    <template v-if="view.kind === 'list'">
      <button
        type="button"
        class="self-start px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="view = { kind: 'create' }"
      >
        Nuevo ítem
      </button>

      <CatalogItemList
        heading-id="catalog-symptoms"
        title="Síntomas"
        :items="symptoms"
        action-label="Editar"
        @select="openItem"
      />
      <CatalogItemList
        heading-id="catalog-triggers"
        title="Triggers / Medicación"
        :items="triggersAndMedication"
        action-label="Editar"
        @select="openItem"
      />
      <CatalogItemList
        v-if="archivedItems.length > 0"
        heading-id="catalog-archived"
        title="Archivados"
        :items="archivedItems"
        action-label="Gestionar"
        tinted
        @select="openItem"
      />
    </template>

    <template v-else-if="view.kind === 'create'">
      <button
        type="button"
        class="inline-flex items-center gap-1 self-start text-sm font-bold text-slate-800 rounded-full"
        :class="FOCUS_RING"
        @click="backToList"
      >
        <ChevronLeft
          :size="16"
          aria-hidden="true"
        />
        Volver al catálogo
      </button>
      <ItemFormPanel
        :root-id="null"
        @done="backToList"
        @cancel="backToList"
      />
    </template>

    <template v-else-if="view.kind === 'edit'">
      <button
        type="button"
        class="inline-flex items-center gap-1 self-start text-sm font-bold text-slate-800 rounded-full"
        :class="FOCUS_RING"
        @click="backToList"
      >
        <ChevronLeft
          :size="16"
          aria-hidden="true"
        />
        Volver al catálogo
      </button>
      <ItemFormPanel
        v-if="!editingArchived"
        :key="`form-${view.rootId}`"
        :root-id="view.rootId"
        @done="backToList"
        @cancel="backToList"
      />
      <ItemLifecycleActions
        :key="`life-${view.rootId}`"
        :root-id="view.rootId"
        :is-archived="editingArchived"
        @done="backToList"
      />
    </template>
  </AppModal>
</template>
