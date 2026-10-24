<script setup lang="ts">
import type { LineageOption } from '../../../application/composables/useCorrelationFilter';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  legend: string;
  options: readonly LineageOption[];
  selected: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  (e: 'toggle', rootId: string): void;
  (e: 'select-all'): void;
}>();
</script>

<template>
  <fieldset class="flex flex-col gap-1">
    <legend class="flex w-full items-center justify-between text-sm font-extrabold text-slate-800">
      {{ legend }}
      <button
        type="button"
        class="px-2 py-0.5 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
        :class="FOCUS_RING"
        @click="emit('select-all')"
      >
        Todos
      </button>
    </legend>
    <p
      v-if="options.length === 0"
      class="text-sm text-slate-600"
    >
      Sin ítems.
    </p>
    <label
      v-for="option in options"
      :key="option.rootId"
      class="flex items-center gap-2 text-sm text-slate-800"
    >
      <input
        type="checkbox"
        :checked="selected.has(option.rootId)"
        class="h-4 w-4 accent-slate"
        :class="FOCUS_RING"
        @change="emit('toggle', option.rootId)"
      >
      <span class="truncate">{{ option.label }}<span v-if="option.archived"> (archivado)</span></span>
    </label>
  </fieldset>
</template>
