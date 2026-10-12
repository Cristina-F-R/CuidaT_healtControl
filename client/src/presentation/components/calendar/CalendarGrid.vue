<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useCalendar } from '../../../application/composables/useCalendar';
import { useDayEntries } from '../../../application/composables/useDayEntries';
import type { DayEntry } from '../../../application/composables/useDayEntries';
import { useInteraction } from '../../../application/composables/useInteraction';
import { useOverlays } from '../../../application/composables/useOverlays';
import { usePlacement } from '../../../application/composables/usePlacement';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import CalendarDayCell from './CalendarDayCell.vue';
import CalendarHeader from './CalendarHeader.vue';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;

const { slots } = useCalendar();
const { entriesByDay } = useDayEntries();
const { draggingItemId, isDragging, endDrag } = useInteraction();
const { placeItem, activateDay } = usePlacement();
const { openOverlay } = useOverlays();
const { activeProfile } = storeToRefs(useProfileStore());

function onDropItem(dayKey: string): void {
  if (draggingItemId.value) {
    placeItem(draggingItemId.value, dayKey);
  }
  endDrag();
}

/** Clicking a dot edits that log in place (TECH_SPEC.md use case 1). */
function onOpenEvent(entry: DayEntry): void {
  openOverlay({ kind: 'eventLog', mode: 'edit', logId: entry.log.id });
}
</script>

<template>
  <section
    aria-labelledby="calendar-title"
    class="flex min-w-0 flex-col gap-4 p-3 bg-canvas rounded-2xl border border-slate-100 shadow-sm sm:p-4 lg:p-6"
  >
    <CalendarHeader :profile-name="activeProfile.name" />
    <div
      aria-hidden="true"
      class="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate sm:gap-1.5"
    >
      <span
        v-for="weekday in WEEKDAYS"
        :key="weekday"
      >{{ weekday }}</span>
    </div>
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
          @activate="activateDay"
          @drop-item="onDropItem"
          @open-event="onOpenEvent"
        />
      </li>
    </ol>
  </section>
</template>
