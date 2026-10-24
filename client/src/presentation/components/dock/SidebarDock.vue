<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useInteraction } from '../../../application/composables/useInteraction';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useToast } from '../../../application/composables/useToast';
import { userMessageOf } from '../../../application/errors';
import { useAuthStore } from '../../../application/stores/useAuthStore';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import DockItemButton from './DockItemButton.vue';

const itemStore = useItemDefinitionStore();
const { items, activeItems, symptoms, triggersAndMedication } = storeToRefs(itemStore);
const { activeProfileId } = storeToRefs(useProfileStore());
const { isSignedIn } = storeToRefs(useAuthStore());
const { showToast } = useToast();
const { canDrag, selectedItemId, clearSelection } = useInteraction();
const { openOverlay } = useOverlays();

const groups = computed(() => [
  { id: 'dock-symptoms', title: 'Síntomas', items: symptoms.value },
  { id: 'dock-triggers', title: 'Triggers / Medicación', items: triggersAndMedication.value },
]);

const hint = computed(() =>
  canDrag.value
    ? 'Selecciona un ítem y pulsa un día, o arrástralo al calendario.'
    : 'Selecciona un ítem y pulsa un día del calendario.',
);

/** Registered calendars start empty: «Añadir ítems de ejemplo» adds the six PRESET_ITEMS (TECH_SPEC.md section 1). */
const showPresetsOffer = computed(() => isSignedIn.value && items.value.length === 0);

async function onAddPresets(): Promise<void> {
  try {
    await itemStore.addPresetItems(activeProfileId.value);
  } catch (error) {
    showToast(`No se pudieron añadir los ítems de ejemplo. ${userMessageOf(error)}`, { tone: 'warning' });
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && selectedItemId.value) {
    clearSelection();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <aside
    aria-labelledby="dock-title"
    class="flex flex-col gap-4 p-4 bg-canvas rounded-2xl border border-slate-100 shadow-sm"
  >
    <div>
      <h2
        id="dock-title"
        class="text-xs font-extrabold uppercase tracking-widest text-slate"
      >
        Añadir al día
      </h2>
      <p class="mt-1 text-sm text-slate">
        {{ hint }}
      </p>
    </div>
    <div
      v-if="showPresetsOffer"
      class="flex flex-col items-start gap-2"
    >
      <p class="text-sm text-slate-800">
        Este calendario todavía no tiene ítems. Empieza con unos de ejemplo o crea los tuyos.
      </p>
      <button
        type="button"
        class="px-3 py-1.5 text-xs font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
        :class="FOCUS_RING"
        @click="onAddPresets"
      >
        Añadir ítems de ejemplo
      </button>
    </div>
    <p
      v-else-if="activeItems.length === 0"
      class="text-sm text-slate-800"
    >
      No hay ítems activos. Crea uno o restaura un archivado.
    </p>
    <button
      type="button"
      class="self-start px-3 py-1.5 text-xs font-bold text-slate-800 border border-slate rounded-full transition-colors hover:bg-tint"
      :class="FOCUS_RING"
      @click="openOverlay({ kind: 'itemManager' })"
    >
      Gestionar ítems
    </button>
    <section
      v-for="group in groups"
      :key="group.id"
      :aria-labelledby="group.id"
      class="flex flex-col gap-1"
    >
      <h3
        :id="group.id"
        class="text-sm font-bold text-slate-800"
      >
        {{ group.title }}
      </h3>
      <ul class="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
        <li
          v-for="item in group.items"
          :key="item.id"
        >
          <DockItemButton :item="item" />
        </li>
      </ul>
    </section>
  </aside>
</template>
