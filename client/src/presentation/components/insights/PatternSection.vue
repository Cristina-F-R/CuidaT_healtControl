<script setup lang="ts">
import type { PatternView } from '../../../application/composables/usePatterns';

defineProps<{
  headingId: string;
  title: string;
  threshold: string;
  emptyText: string;
  surface: 'bg-tint' | 'bg-mint/40';
  patterns: PatternView[];
}>();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-1 p-4 rounded-xl"
    :class="surface"
  >
    <h3
      :id="headingId"
      class="text-sm font-extrabold text-slate-800"
    >
      {{ title }}
    </h3>
    <p class="text-xs font-bold text-slate-800">
      {{ threshold }}
    </p>
    <ul
      v-if="patterns.length > 0"
      class="mt-1 flex flex-col gap-2"
    >
      <li
        v-for="pattern in patterns"
        :key="pattern.key"
        class="text-sm text-slate-800"
      >
        {{ pattern.triggerLabel }} → {{ pattern.symptomLabel }}
        <span class="text-xs font-bold">· {{ pattern.occurrences }} coincidencias</span>
      </li>
    </ul>
    <p
      v-else
      class="mt-1 text-sm text-slate-800"
    >
      {{ emptyText }}
    </p>
  </section>
</template>
