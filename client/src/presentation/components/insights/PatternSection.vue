<script setup lang="ts">
import type { DayMark, PatternView } from '../../../application/composables/usePatterns';
import { PATTERN_STYLE } from '../../categoryStyles';

// Same color and icon as the consultation day marks: `sun` to watch, `peach` detected (TECH_SPEC.md section 2).
defineProps<{
  headingId: string;
  tone: DayMark;
  threshold: string;
  emptyText: string;
  patterns: PatternView[];
}>();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-2"
  >
    <h3
      :id="headingId"
      class="flex items-center gap-2 text-sm font-extrabold text-slate-800"
    >
      <span
        aria-hidden="true"
        class="grid h-6 w-6 place-items-center rounded-full"
        :class="PATTERN_STYLE[tone].surface"
      >
        <component
          :is="PATTERN_STYLE[tone].icon"
          :size="14"
        />
      </span>
      {{ PATTERN_STYLE[tone].label }}
    </h3>
    <p class="text-xs font-bold text-slate">
      {{ threshold }}
    </p>
    <ul
      v-if="patterns.length > 0"
      class="flex flex-col gap-2"
    >
      <li
        v-for="pattern in patterns"
        :key="pattern.key"
        class="flex items-center justify-between gap-3 p-3 text-sm text-slate-800 rounded-xl"
        :class="PATTERN_STYLE[tone].surface"
      >
        <span class="min-w-0 font-bold">{{ pattern.triggerLabel }} → {{ pattern.symptomLabel }}</span>
        <span class="flex shrink-0 flex-col items-end leading-none">
          <span class="text-xl font-extrabold">{{ pattern.occurrences }}</span>
          <span class="text-xs font-bold">coincidencias</span>
        </span>
      </li>
    </ul>
    <!-- Empty too, the box keeps the color of its threshold, so both sections read at a glance. -->
    <p
      v-else
      class="p-3 text-sm text-slate-800 rounded-xl"
      :class="PATTERN_STYLE[tone].surface"
    >
      {{ emptyText }}
    </p>
  </section>
</template>
