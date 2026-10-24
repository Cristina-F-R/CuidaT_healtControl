<script setup lang="ts">
import { MONTH_DENSITIES, useMultiMonth } from '../../../application/composables/useMultiMonth';
import { FOCUS_RING } from '../../categoryStyles';

// Segmented control `1M | 2M | 3M`. Guests are locked at 1M: the other options show the notice.
const { density, setDensity } = useMultiMonth();
</script>

<template>
  <div
    role="group"
    aria-label="Meses visibles"
    class="inline-flex p-1 gap-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl"
  >
    <button
      v-for="option in MONTH_DENSITIES"
      :key="option"
      type="button"
      :aria-pressed="density === option"
      class="px-2.5 py-1 rounded-lg transition-all"
      :class="[FOCUS_RING, density === option && 'text-slate-800 bg-canvas shadow-sm']"
      @click="setDensity(option)"
    >
      {{ option }}M
    </button>
  </div>
</template>
