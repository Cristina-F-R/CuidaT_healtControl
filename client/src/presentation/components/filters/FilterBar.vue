<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useViewMode } from '../../../application/composables/useViewMode';
import { useEventStore } from '../../../application/stores/useEventStore';
import type { EventFilter } from '../../../application/stores/useEventStore';
import { FOCUS_RING } from '../../categoryStyles';

const FILTERS: ReadonlyArray<{ value: EventFilter; label: string }> = [
  { value: 'all', label: 'Ver todo' },
  { value: 'symptoms', label: 'Solo síntomas' },
  { value: 'triggers', label: 'Solo triggers' },
];

const { activeFilter } = storeToRefs(useEventStore());
const { consultationMode, setConsultationMode } = useViewMode();
// Screen readers hear the change: the whole workspace switches between editing and read-only.
const announcement = ref('');

function toggleConsultation(): void {
  setConsultationMode(!consultationMode.value);
  announcement.value = consultationMode.value ? 'Modo consulta activado' : 'Modo consulta desactivado';
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
    <div
      role="group"
      aria-label="Filtrar registros del calendario"
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="filter in FILTERS"
        :key="filter.value"
        type="button"
        :aria-pressed="activeFilter === filter.value"
        class="px-4 py-2 text-sm font-bold rounded-full transition-colors"
        :class="[
          FOCUS_RING,
          activeFilter === filter.value ? 'text-canvas bg-slate' : 'text-slate-800 bg-tint hover:bg-slate-100',
        ]"
        @click="activeFilter = filter.value"
      >
        {{ filter.label }}
      </button>
    </div>
    <!-- Consultation mode (TECH_SPEC.md use case 12): read-only workspace for medical visits. -->
    <button
      type="button"
      role="switch"
      :aria-checked="consultationMode"
      class="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-800 rounded-full hover:bg-tint"
      :class="FOCUS_RING"
      @click="toggleConsultation"
    >
      <span
        aria-hidden="true"
        class="relative inline-block h-5 w-9 rounded-full transition-colors"
        :class="consultationMode ? 'bg-slate-700' : 'bg-slate-300'"
      >
        <span
          class="absolute left-0.5 top-0.5 h-4 w-4 bg-canvas rounded-full transition-transform"
          :class="consultationMode && 'translate-x-4'"
        />
      </span>
      Modo consulta
    </button>
    <p
      aria-live="polite"
      class="sr-only"
    >
      {{ announcement }}
    </p>
  </div>
</template>
