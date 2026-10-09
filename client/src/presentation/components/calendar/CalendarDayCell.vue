<script setup lang="ts">
import { FUTURE_DATE_WARNING } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { DayEntry } from '../../../application/composables/useDayEntries';
import { useToast } from '../../../application/composables/useToast';
import EventDot from './EventDot.vue';

const props = defineProps<{
  dayKey: string;
  entries: DayEntry[];
  isDragging: boolean;
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
  return `${date}${isToday.value ? ' (hoy)' : ''}, ${count} ${count === 1 ? 'registro' : 'registros'}`;
});

const surfaceClass = computed(() => {
  if (isFuture.value) {
    return 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed';
  }
  if (isDropTarget.value) {
    return 'bg-tint/30 border-dashed border-mint';
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
