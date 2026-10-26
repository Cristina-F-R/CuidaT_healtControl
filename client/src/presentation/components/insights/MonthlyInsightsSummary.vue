<script setup lang="ts">
import { PATTERN_DETECTED_MIN_OCCURRENCES, PATTERN_WATCH_MIN_OCCURRENCES } from '@cuidat/shared';
import type { ItemCategory } from '@cuidat/shared';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useCalendar } from '../../../application/composables/useCalendar';
import { useMultiMonth } from '../../../application/composables/useMultiMonth';
import { usePatterns } from '../../../application/composables/usePatterns';
import { useEventStore } from '../../../application/stores/useEventStore';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { FOCUS_RING } from '../../categoryStyles';
import PatternSection from './PatternSection.vue';

const { monthName } = useCalendar();
const { visibleMonthKeys, oldestMonthKey } = useMultiMonth();
const { logsByDay } = storeToRefs(useEventStore());
const itemStore = useItemDefinitionStore();
const { activeProfile } = storeToRefs(useProfileStore());
const { watchPatterns, detectedPatterns } = usePatterns();
const { openOverlay } = useOverlays();

// The rail describes the visible months (1M, 2M or 3M), the same range as the patterns: «Resumen de agosto a octubre».
const periodName = computed(() =>
  visibleMonthKeys.value.length > 1
    ? `${dayjs(`${oldestMonthKey.value}-01`).format('MMMM')} a ${monthName.value}`
    : monthName.value,
);

const totals = computed(() => {
  const counts: Record<ItemCategory, number> = { symptom: 0, trigger: 0, medication: 0 };
  for (const [dayKey, logs] of logsByDay.value) {
    if (!visibleMonthKeys.value.includes(dayKey.slice(0, 7))) {
      continue;
    }
    for (const log of logs) {
      const item = itemStore.findById(log.itemDefinitionId);
      if (item) {
        counts[item.category] += 1;
      }
    }
  }
  return counts;
});

const stats = computed(() => [
  { label: 'síntomas registrados', value: totals.value.symptom },
  { label: 'triggers añadidos', value: totals.value.trigger },
  { label: 'tomas de medicación', value: totals.value.medication },
]);

const WATCH_THRESHOLD = `Entre ${PATTERN_WATCH_MIN_OCCURRENCES} y ${PATTERN_DETECTED_MIN_OCCURRENCES - 1} coincidencias`;
const DETECTED_THRESHOLD = `${PATTERN_DETECTED_MIN_OCCURRENCES} o más coincidencias`;
</script>

<template>
  <aside
    aria-labelledby="insights-title"
    class="flex flex-col gap-5 p-4 bg-canvas rounded-2xl border border-slate-100 shadow-sm lg:p-6"
  >
    <div>
      <p class="text-xs font-extrabold uppercase tracking-widest text-slate">
        Resumen de {{ periodName }}
      </p>
      <h2
        id="insights-title"
        class="text-lg font-semibold text-slate-800"
      >
        La historia de {{ activeProfile.name }}
      </h2>
    </div>
    <dl class="grid grid-cols-3 gap-3 lg:grid-cols-1">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex flex-col-reverse"
      >
        <dt class="text-sm text-slate">
          {{ stat.label }}
        </dt>
        <dd class="text-2xl font-extrabold text-slate-800">
          {{ stat.value }}
        </dd>
      </div>
    </dl>
    <PatternSection
      heading-id="pattern-watch"
      tone="watch"
      :threshold="WATCH_THRESHOLD"
      empty-text="Todavía no hay coincidencias suficientes."
      :patterns="watchPatterns"
    />
    <PatternSection
      heading-id="pattern-detected"
      tone="detected"
      :threshold="DETECTED_THRESHOLD"
      empty-text="Ningún patrón detectado todavía."
      :patterns="detectedPatterns"
    />
    <button
      type="button"
      class="self-start px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700"
      :class="FOCUS_RING"
      @click="openOverlay({ kind: 'correlationFilter' })"
    >
      Ver resúmenes
    </button>
    <p class="text-xs text-slate">
      Una coincidencia no confirma una causa. Puede ser útil comentarla con un profesional.
    </p>
  </aside>
</template>
