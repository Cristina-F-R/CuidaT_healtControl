<script setup lang="ts">
import type { ReportSnapshot } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import { monthLabelOf } from '../../../application/composables/useCalendar';
import { miniMonth, reportItems } from '../../../application/reportFormat';
import { PATTERN_STYLE } from '../../categoryStyles';

// One month of a saved report, drawn like the consultation mode: the selected items of each day and
// the pattern marks (TECH_SPEC.md use case 12). Read-only: nothing here is interactive.
const props = defineProps<{
  snapshot: ReportSnapshot;
  monthKey: string;
}>();

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const slots = computed(() => miniMonth(props.snapshot, props.monthKey));
const emojisByDay = computed(() => {
  const items = reportItems(props.snapshot);
  return new Map(props.snapshot.days.map((day) => [day.date, day.logs.map((log) => items.get(log.rootId)?.emoji ?? '•')]));
});

function dayLabel(date: string, mark: keyof typeof PATTERN_STYLE | null, count: number): string {
  const pattern = mark ? ` · ${PATTERN_STYLE[mark].label}` : '';
  return `${dayjs(date).format('D [de] MMMM')}, ${count} ${count === 1 ? 'registro' : 'registros'}${pattern}`;
}
</script>

<template>
  <figure class="flex flex-col gap-1">
    <figcaption class="text-sm font-bold text-slate-800">
      {{ monthLabelOf(monthKey) }}
    </figcaption>
    <div
      aria-hidden="true"
      class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate"
    >
      <span
        v-for="weekday in WEEKDAYS"
        :key="weekday"
      >{{ weekday }}</span>
    </div>
    <ol class="grid grid-cols-7 gap-1">
      <li
        v-for="(slot, index) in slots"
        :key="slot?.date ?? `blank-${index}`"
        :aria-hidden="slot ? undefined : 'true'"
      >
        <div
          v-if="slot"
          :aria-label="dayLabel(slot.date, slot.mark, slot.symptoms + slot.triggers)"
          role="group"
          class="relative flex h-full min-h-[52px] flex-col gap-0.5 p-1 text-xs text-slate-800 rounded-lg"
          :class="slot.mark ? ['bg-canvas border-2', PATTERN_STYLE[slot.mark].border] : slot.inPeriod ? 'bg-canvas border border-slate-100' : 'bg-slate-50 border border-slate-100 opacity-60'"
        >
          <span
            v-if="slot.mark"
            aria-hidden="true"
            class="absolute inset-x-0 top-0 h-1 rounded-t-md"
            :class="PATTERN_STYLE[slot.mark].surface"
          />
          <span class="flex items-center justify-between gap-0.5 font-extrabold">
            {{ slot.day }}
            <span
              v-if="slot.mark"
              aria-hidden="true"
              class="grid h-4 w-4 place-items-center rounded-full"
              :class="PATTERN_STYLE[slot.mark].surface"
            >
              <component
                :is="PATTERN_STYLE[slot.mark].icon"
                :size="10"
              />
            </span>
          </span>
          <span
            aria-hidden="true"
            class="flex flex-wrap leading-tight"
          >{{ (emojisByDay.get(slot.date) ?? []).join('') }}</span>
        </div>
      </li>
    </ol>
  </figure>
</template>
