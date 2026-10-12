<script setup lang="ts">
import { DAY_PART_PRESETS } from '@cuidat/shared';
import { FOCUS_RING } from '../../categoryStyles';

// The time is always required (ADR-016). Presets are shortcuts; the input allows 15-minute steps.
const props = defineProps<{
  modelValue: string;
  /** `HH:mm` ceiling for today, so the time never passes the current instant. */
  max?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

function formatPreset(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function choosePreset(hour: number, minute: number): void {
  const value = formatPreset(hour, minute);
  emit('update:modelValue', props.max !== undefined && value > props.max ? props.max : value);
}
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="text-sm font-bold text-slate-800">
      Hora
    </legend>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="preset in DAY_PART_PRESETS"
        :key="preset.label"
        type="button"
        class="px-2.5 py-1 text-xs font-bold rounded-full transition-colors"
        :class="[FOCUS_RING, modelValue === formatPreset(preset.hour, preset.minute) ? 'text-canvas bg-slate' : 'text-slate-800 bg-tint hover:bg-slate-100']"
        @click="choosePreset(preset.hour, preset.minute)"
      >
        {{ preset.label }} {{ formatPreset(preset.hour, preset.minute) }}
      </button>
    </div>
    <input
      type="time"
      step="900"
      :max="max"
      :value="modelValue"
      aria-label="Hora exacta del registro"
      class="w-32 px-2 py-1.5 text-sm font-bold text-slate-800 bg-canvas border border-slate-200 rounded-lg"
      :class="FOCUS_RING"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </fieldset>
</template>
