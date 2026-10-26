<script setup lang="ts">
import { computed } from 'vue';
import { buildSlots, monthLabelOf } from '../../../application/composables/useCalendar';
import { useDayEntries } from '../../../application/composables/useDayEntries';
import type { DayEntry } from '../../../application/composables/useDayEntries';
import { useInteraction } from '../../../application/composables/useInteraction';
import { useOverlays } from '../../../application/composables/useOverlays';
import type { DayMark } from '../../../application/composables/usePatterns';
import { usePlacement } from '../../../application/composables/usePlacement';
import { useViewMode } from '../../../application/composables/useViewMode';
import CalendarDayCell from './CalendarDayCell.vue';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

// One month of the calendar (`YYYY-MM`). Several grids are stacked for the 2M and 3M density.
const props = defineProps<{
  monthKey: string;
  /** Shows the month name above the grid (stacked months); a single month is named by the header. */
  showTitle: boolean;
  /** Consultation mode only (empty otherwise): pattern days of the visible range (TECH_SPEC.md use case 12). */
  dayMarks: ReadonlyMap<string, DayMark>;
}>();

const slots = computed(() => buildSlots(props.monthKey));
const { entriesByDay } = useDayEntries();
const { draggingItemId, isDragging, endDrag } = useInteraction();
const { placeItem, activateDay } = usePlacement();
const { openOverlay } = useOverlays();
const { consultationMode } = useViewMode();

function onDropItem(dayKey: string): void {
  if (draggingItemId.value) {
    placeItem(draggingItemId.value, dayKey);
  }
  endDrag();
}

/** Clicking a dot edits that log in place (TECH_SPEC.md use case 1); consultation mode only shows it. */
function onOpenEvent(entry: DayEntry): void {
  const logId = entry.log.id;
  openOverlay(consultationMode.value ? { kind: 'eventDetail', logId } : { kind: 'eventLog', mode: 'edit', logId });
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <h3
      v-if="showTitle"
      class="text-lg font-semibold text-slate-800"
    >
      {{ monthLabelOf(monthKey) }}
    </h3>
    <div
      aria-hidden="true"
      class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate sm:gap-1.5"
    >
      <span
        v-for="weekday in WEEKDAYS"
        :key="weekday"
      >{{ weekday }}</span>
    </div>
    <!-- No fixed row height: cells grow so no card is ever hidden (ADR-004). -->
    <ol class="grid grid-cols-7 gap-1 sm:gap-1.5">
      <li
        v-for="(slot, index) in slots"
        :key="slot ?? `blank-${index}`"
        :aria-hidden="slot ? undefined : 'true'"
      >
        <CalendarDayCell
          v-if="slot"
          :day-key="slot"
          :entries="entriesByDay.get(slot) ?? []"
          :is-dragging="isDragging"
          :mark="dayMarks.get(slot)"
          @activate="activateDay"
          @drop-item="onDropItem"
          @open-event="onOpenEvent"
        />
      </li>
    </ol>
  </div>
</template>
