<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';
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

      <section
        aria-labelledby="catalog-symptoms"
        class="flex flex-col gap-2"
      >
        <h3
          id="catalog-symptoms"
          class="text-sm font-extrabold text-slate-800"
        >
          Síntomas
        </h3>
        <ul class="flex flex-col gap-1">
          <li
            v-for="item in symptoms"
            :key="item.id"
            class="flex items-center justify-between gap-2"
          >
            <span class="flex min-w-0 items-center gap-2 text-sm text-slate-800"><span aria-hidden="true">{{ item.emoji }}</span><span class="truncate">{{ item.name }}</span></span>
            <button
              type="button"
              :aria-label="`Editar ${item.name}`"
              class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
              :class="FOCUS_RING"
              @click="view = { kind: 'edit', rootId: item.rootId }"
            >
              Editar
            </button>
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="catalog-triggers"
        class="flex flex-col gap-2"
      >
        <h3
          id="catalog-triggers"
          class="text-sm font-extrabold text-slate-800"
        >
          Triggers / Medicación
        </h3>
        <ul class="flex flex-col gap-1">
          <li
            v-for="item in triggersAndMedication"
            :key="item.id"
            class="flex items-center justify-between gap-2"
          >
            <span class="flex min-w-0 items-center gap-2 text-sm text-slate-800"><span aria-hidden="true">{{ item.emoji }}</span><span class="truncate">{{ item.name }}</span></span>
            <button
              type="button"
              :aria-label="`Editar ${item.name}`"
              class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
              :class="FOCUS_RING"
              @click="view = { kind: 'edit', rootId: item.rootId }"
            >
              Editar
            </button>
          </li>
        </ul>
      </section>

      <section
        v-if="archivedItems.length > 0"
        aria-labelledby="catalog-archived"
        class="flex flex-col gap-2 p-3 bg-tint rounded-xl"
      >
        <h3
          id="catalog-archived"
          class="text-sm font-extrabold text-slate-800"
        >
          Archivados
        </h3>
        <ul class="flex flex-col gap-1">
          <li
            v-for="item in archivedItems"
            :key="item.id"
            class="flex items-center justify-between gap-2"
          >
            <span class="flex min-w-0 items-center gap-2 text-sm text-slate-800"><span aria-hidden="true">{{ item.emoji }}</span><span class="truncate">{{ item.name }}</span></span>
            <button
              type="button"
              :aria-label="`Gestionar ${item.name} archivado`"
              class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-canvas"
              :class="FOCUS_RING"
              @click="view = { kind: 'edit', rootId: item.rootId }"
            >
              Gestionar
            </button>
          </li>
        </ul>
      </section>
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
