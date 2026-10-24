<script setup lang="ts">
import { useId } from 'vue';
import { PROFILE_TYPE_MAX_LENGTH } from '@cuidat/shared';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  modelValue: string;
  suggestions: readonly string[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// Combobox: a text input with a list of suggestions. Typing a type that is not listed creates it.
const listId = useId();
</script>

<template>
  <label class="flex flex-col gap-2 text-sm font-bold text-slate-800">
    Tipo de perfil
    <input
      :value="modelValue"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      autocomplete="off"
      :list="listId"
      :maxlength="PROFILE_TYPE_MAX_LENGTH"
      required
      class="px-2 py-1.5 font-normal text-slate-800 bg-canvas border border-slate-200 rounded-lg"
      :class="FOCUS_RING"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
    <datalist :id="listId">
      <option
        v-for="suggestion in suggestions"
        :key="suggestion"
        :value="suggestion"
      />
    </datalist>
    <span class="font-normal text-slate-600">Elige uno de la lista o escribe uno nuevo.</span>
  </label>
</template>
