<script setup lang="ts">
import type { ReportSnapshot } from '@cuidat/shared';
import { computed } from 'vue';
import { CATEGORY_LABELS, formatReportDate, logDetails, reportItems } from '../../../application/reportFormat';
import { PATTERN_STYLE } from '../../categoryStyles';

// Day-by-day logs of a saved report: time, item, metrics and notes, with the day's pattern mark.
const props = defineProps<{
  snapshot: ReportSnapshot;
}>();

const items = computed(() => reportItems(props.snapshot));
</script>

<template>
  <section
    aria-labelledby="report-days"
    class="flex flex-col gap-3"
  >
    <h3
      id="report-days"
      class="text-base font-extrabold text-slate-800"
    >
      Registros día a día
    </h3>
    <p
      v-if="snapshot.days.length === 0"
      class="p-3 text-sm text-slate-800 bg-tint rounded-xl"
    >
      No hay registros de los ítems elegidos en este periodo.
    </p>
    <ol
      v-else
      class="flex flex-col gap-3"
    >
      <li
        v-for="day in snapshot.days"
        :key="day.date"
        class="flex flex-col gap-1"
      >
        <p class="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-800">
          {{ formatReportDate(day.date) }}
          <span
            v-if="day.mark"
            class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full"
            :class="PATTERN_STYLE[day.mark].surface"
          >
            <component
              :is="PATTERN_STYLE[day.mark].icon"
              :size="12"
              aria-hidden="true"
            />
            {{ PATTERN_STYLE[day.mark].label }}
          </span>
        </p>
        <ul class="flex flex-col gap-1 pl-1">
          <li
            v-for="(log, index) in day.logs"
            :key="index"
            class="text-sm text-slate-800"
          >
            <span class="font-bold">{{ log.time }} · {{ items.get(log.rootId)?.emoji }} {{ items.get(log.rootId)?.name }}</span>
            <span class="text-xs text-slate"> ({{ CATEGORY_LABELS[items.get(log.rootId)?.category ?? 'symptom'] }})</span>
            <span v-if="logDetails(log)"> — {{ logDetails(log) }}</span>
            <span
              v-if="log.notes"
              class="block break-words text-xs text-slate-600"
            >Notas: {{ log.notes }}</span>
          </li>
        </ul>
      </li>
    </ol>
  </section>
</template>
