<script setup lang="ts">
import { PROFILE_COLOR_THEMES } from '@cuidat/shared';
import type { ProfileColorTheme } from '@cuidat/shared';
import { FOCUS_RING, PROFILE_THEME } from '../../categoryStyles';

// Color theme pills of ProfileEditModal.vue (STYLE_GUIDE.md, Profile Lifecycle Modals).
defineProps<{
  modelValue: ProfileColorTheme;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ProfileColorTheme): void;
}>();
</script>

<template>
  <div class="flex flex-col gap-2 text-sm font-bold text-slate-800">
    Color
    <div
      role="group"
      aria-label="Color del calendario"
      class="flex flex-wrap gap-2"
    >
      <button
        v-for="theme in PROFILE_COLOR_THEMES"
        :key="theme"
        type="button"
        :aria-pressed="modelValue === theme"
        class="px-3 py-1 text-xs font-bold text-slate-800 border rounded-full transition-colors"
        :class="[FOCUS_RING, PROFILE_THEME[theme].surface, modelValue === theme ? 'border-slate' : 'border-transparent']"
        @click="emit('update:modelValue', theme)"
      >
        {{ PROFILE_THEME[theme].label }}
      </button>
    </div>
  </div>
</template>
