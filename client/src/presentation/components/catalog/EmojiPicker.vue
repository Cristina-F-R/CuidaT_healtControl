<script setup lang="ts">
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const EMOJIS: readonly string[] = [
  '🤢', '🤮', '💩', '😣', '🤕', '🤒', '😴', '😵',
  '🩹', '🩺', '💊', '🧪', '🌡️', '🫀', '❤️', '🧠',
  '🐟', '🥛', '🧀', '🥚', '🍓', '🌶️', '🍫', '🍞',
];
</script>

<template>
  <div
    role="group"
    aria-label="Emoji del ítem"
    class="grid grid-cols-8 gap-1"
  >
    <button
      v-for="emoji in EMOJIS"
      :key="emoji"
      type="button"
      :aria-label="`Usar ${emoji}`"
      :aria-pressed="modelValue === emoji"
      class="grid h-9 w-9 place-items-center text-lg rounded-lg transition-colors"
      :class="[FOCUS_RING, modelValue === emoji ? 'bg-slate' : 'bg-tint hover:bg-slate-100']"
      @click="emit('update:modelValue', emoji)"
    >
      <span aria-hidden="true">{{ emoji }}</span>
    </button>
  </div>
</template>
