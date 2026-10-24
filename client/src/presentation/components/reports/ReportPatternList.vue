<script setup lang="ts">
import type { DayMark, ReportSnapshot } from '@cuidat/shared';
import { computed } from 'vue';
import { reportItems } from '../../../application/reportFormat';
import { PATTERN_STYLE } from '../../categoryStyles';

// Patterns of a saved report, with the colors of the consultation mode (detected first).
const props = defineProps<{
  snapshot: ReportSnapshot;
}>();

const TONES: readonly DayMark[] = ['detected', 'watch'];
const items = computed(() => reportItems(props.snapshot));

function label(rootId: string): string {
  const item = items.value.get(rootId);
  return item ? `${item.emoji} ${item.name}` : '—';
}

function patternsOf(tone: DayMark): ReportSnapshot['patterns'] {
  return props.snapshot.patterns.filter((pattern) => pattern.category === PATTERN_STYLE[tone].label);
}
</script>

<template>
  <section
    aria-labelledby="report-patterns"
    class="flex flex-col gap-3"
  >
    <h3
      id="report-patterns"
      class="text-base font-extrabold text-slate-800"
    >
      Patrones
    </h3>
    <div
      v-for="tone in TONES"
      :key="tone"
      class="flex flex-col gap-2"
    >
      <p class="flex items-center gap-2 text-sm font-bold text-slate-800">
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
      </p>
      <ul
        v-if="patternsOf(tone).length > 0"
        class="flex flex-col gap-2"
      >
        <li
          v-for="pattern in patternsOf(tone)"
          :key="`${pattern.triggerRootId}|${pattern.symptomRootId}`"
          class="flex items-center justify-between gap-3 p-3 text-sm text-slate-800 rounded-xl"
          :class="PATTERN_STYLE[tone].surface"
        >
          <span class="font-bold">{{ label(pattern.triggerRootId) }} → {{ label(pattern.symptomRootId) }}</span>
          <span class="shrink-0 font-extrabold">{{ pattern.occurrences }} coincidencias</span>
        </li>
      </ul>
      <p
        v-else
        class="p-3 text-sm text-slate-800 rounded-xl"
        :class="PATTERN_STYLE[tone].surface"
      >
        Ninguno en este periodo.
      </p>
    </div>
  </section>
</template>
