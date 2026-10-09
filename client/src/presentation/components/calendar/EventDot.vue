<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { DayEntry } from '../../../application/composables/useDayEntries';
import { CATEGORY_SURFACE, FOCUS_RING } from '../../categoryStyles';

const props = defineProps<{
  entry: DayEntry;
}>();

const emit = defineEmits<{
  (e: 'open', entry: DayEntry): void;
}>();

const label = computed(
  () => `${props.entry.item.name}, ${dayjs(props.entry.log.loggedAt).format('HH:mm')}. Ver registro`,
);
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    class="pointer-events-auto relative z-10 grid h-8 w-8 place-items-center text-base rounded-lg transition-transform hover:scale-105"
    :class="[FOCUS_RING, CATEGORY_SURFACE[entry.item.category]]"
    @click="emit('open', entry)"
  >
    <span aria-hidden="true">{{ entry.item.emoji }}</span>
  </button>
</template>
