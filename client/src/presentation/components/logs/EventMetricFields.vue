<script setup lang="ts">
import { NOTES_MAX_LENGTH } from '@cuidat/shared';
import type { Intensity } from '@cuidat/shared';
import { computed } from 'vue';
import { FOCUS_RING } from '../../categoryStyles';

// Metrics follow the item definition (TECH_SPEC.md section 1, configuration).
const props = defineProps<{
  trackIntensity: boolean;
  trackDuration: boolean;
  intensity: Intensity | null;
  durationText: string;
  notes: string;
}>();

const emit = defineEmits<{
  (e: 'update:intensity', value: Intensity | null): void;
  (e: 'update:durationText', value: string): void;
  (e: 'update:notes', value: string): void;
}>();

const INTENSITY_OPTIONS: ReadonlyArray<{ value: Intensity; label: string }> = [
  { value: 1, label: 'Leve' },
  { value: 2, label: 'Moderada' },
  { value: 3, label: 'Grave' },
];

const noteLength = computed(() => [...props.notes].length);

function chooseIntensity(value: Intensity): void {
  emit('update:intensity', props.intensity === value ? null : value);
}

function readInput(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <fieldset
      v-if="trackIntensity"
      class="flex flex-col gap-2"
    >
      <legend class="text-sm font-bold text-slate-800">
        Intensidad
      </legend>
      <div class="flex gap-1.5">
        <button
          v-for="option in INTENSITY_OPTIONS"
          :key="option.value"
          type="button"
          :aria-pressed="intensity === option.value"
          class="flex-1 px-2 py-1.5 text-xs font-bold rounded-lg transition-colors"
          :class="[FOCUS_RING, intensity === option.value ? 'text-slate-800 bg-peach' : 'text-slate-800 bg-tint hover:bg-slate-100']"
          @click="chooseIntensity(option.value)"
        >
          {{ option.value }} · {{ option.label }}
        </button>
      </div>
    </fieldset>

    <label
      v-if="trackDuration"
      class="flex flex-col gap-2 text-sm font-bold text-slate-800"
    >
      Duración (minutos)
      <input
        type="number"
        inputmode="numeric"
        min="1"
        max="1440"
        step="1"
        :value="durationText"
        class="w-32 px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg"
        :class="FOCUS_RING"
        @input="emit('update:durationText', readInput($event))"
      >
    </label>

    <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
      Notas
      <textarea
        rows="3"
        :maxlength="NOTES_MAX_LENGTH"
        :value="notes"
        class="px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg resize-y"
        :class="FOCUS_RING"
        @input="emit('update:notes', readInput($event))"
      />
      <span class="self-end text-xs font-normal text-slate">{{ noteLength }}/{{ NOTES_MAX_LENGTH }}</span>
    </label>
  </div>
</template>
