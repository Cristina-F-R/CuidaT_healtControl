<script setup lang="ts">
import { FUTURE_DATE_WARNING } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { DayEntry } from '../../../application/composables/useDayEntries';
import type { DayMark } from '../../../application/composables/usePatterns';
import { useToast } from '../../../application/composables/useToast';
import { PATTERN_STYLE } from '../../categoryStyles';
import EventDot from './EventDot.vue';

const props = defineProps<{
  dayKey: string;
  entries: DayEntry[];
  isDragging: boolean;
  /** Consultation mode: the day holds a symptom of a reported pattern (TECH_SPEC.md use case 12). */
  mark?: DayMark;
}>();

const emit = defineEmits<{
  (e: 'activate', dayKey: string): void;
  (e: 'drop-item', dayKey: string): void;
  (e: 'open-event', entry: DayEntry): void;
}>();

const { showToast } = useToast();

const isFuture = computed(() => dayjs(props.dayKey).isAfter(dayjs(), 'day'));
const isToday = computed(() => dayjs(props.dayKey).isSame(dayjs(), 'day'));
const isDropTarget = computed(() => props.isDragging && !isFuture.value);
const dayNumber = computed(() => dayjs(props.dayKey).date());
const dayLabel = computed(() => {
  const date = dayjs(props.dayKey).format('dddd, D [de] MMMM [de] YYYY');
  const count = props.entries.length;
  const pattern = props.mark ? ` · ${PATTERN_STYLE[props.mark].label}` : '';
  return `${date}${isToday.value ? ' (hoy)' : ''}, ${count} ${count === 1 ? 'registro' : 'registros'}${pattern}`;
});

const surfaceClass = computed(() => {
  if (isFuture.value) {
    return 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed';
  }
  if (isDropTarget.value) {
    return 'bg-tint/30 border-dashed border-mint';
  }
  if (props.mark) {
    // The cell keeps bg-canvas: symptom cards are peach too, so only the edge carries the mark.
    return `bg-canvas border-2 ${PATTERN_STYLE[props.mark].border}`;
  }
  return 'bg-canvas border-slate-100';
});

function onActivate(): void {
  if (isFuture.value) {
    showToast(FUTURE_DATE_WARNING, { tone: 'warning' });
    return;
  }
  emit('activate', props.dayKey);
}

function onDragOver(event: DragEvent): void {
  if (!isDropTarget.value) {
    return;
  }
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }
}

function onDrop(event: DragEvent): void {
  if (!isDropTarget.value) {
    return;
  }
  event.preventDefault();
  emit('drop-item', props.dayKey);
}
</script>

<template>
  <!-- ADR-015: non-interactive container, stretched day button, event dots raised above it. -->
  <div
    class="relative min-h-[110px] h-full flex flex-col p-1.5 rounded-xl border transition-colors"
    :class="[surfaceClass, isToday && 'ring-2 ring-slate']"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <span
      v-if="mark"
      aria-hidden="true"
      class="pointer-events-none absolute inset-x-0 top-0 h-1.5 rounded-t-lg"
      :class="PATTERN_STYLE[mark].surface"
    />
    <!-- The badge sits next to the day number and wraps below it in narrow cells, so it never covers it. -->
    <div class="flex flex-wrap items-start justify-between gap-0.5">
      <button
        type="button"
        :aria-label="dayLabel"
        :aria-disabled="isFuture || undefined"
        class="self-start px-1 text-xs font-extrabold text-slate-800 rounded after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-slate"
        :class="isFuture ? 'cursor-not-allowed' : 'cursor-pointer'"
        @click="onActivate"
      >
        {{ dayNumber }}<span v-if="isToday"> · Hoy</span>
      </button>
      <span
        v-if="mark"
        aria-hidden="true"
        class="pointer-events-none grid h-5 w-5 place-items-center text-slate-800 rounded-full"
        :class="PATTERN_STYLE[mark].surface"
      >
        <component
          :is="PATTERN_STYLE[mark].icon"
          :size="12"
        />
      </span>
    </div>
    <ul
      v-if="entries.length > 0"
      class="pointer-events-none relative z-10 mt-1 flex flex-wrap gap-1"
    >
      <li
        v-for="entry in entries"
        :key="entry.log.id"
      >
        <EventDot
          :entry="entry"
          @open="emit('open-event', $event)"
        />
      </li>
    </ul>
  </div>
</template>
