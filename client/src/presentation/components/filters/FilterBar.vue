<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useEventStore } from '../../../application/stores/useEventStore';
import type { EventFilter } from '../../../application/stores/useEventStore';
import { FOCUS_RING } from '../../categoryStyles';

const FILTERS: ReadonlyArray<{ value: EventFilter; label: string }> = [
  { value: 'all', label: 'Ver todo' },
  { value: 'symptoms', label: 'Solo síntomas' },
  { value: 'triggers', label: 'Solo triggers' },
];

const { activeFilter } = storeToRefs(useEventStore());
</script>

<template>
  <div
    role="group"
    aria-label="Filtrar registros del calendario"
    class="flex flex-wrap gap-2 py-4"
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
</template>
