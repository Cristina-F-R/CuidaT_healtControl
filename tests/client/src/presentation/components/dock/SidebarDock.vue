<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useInteraction } from '../../../application/composables/useInteraction';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import DockItemButton from './DockItemButton.vue';

const { symptoms, triggersAndMedication } = storeToRefs(useItemDefinitionStore());
const { canDrag, selectedItemId, clearSelection } = useInteraction();

const groups = computed(() => [
  { id: 'dock-symptoms', title: 'Síntomas', items: symptoms.value },
  { id: 'dock-triggers', title: 'Triggers / Medicación', items: triggersAndMedication.value },
]);

const hint = computed(() =>
  canDrag.value
    ? 'Selecciona un ítem y pulsa un día, o arrástralo al calendario.'
    : 'Selecciona un ítem y pulsa un día del calendario.',
);

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
