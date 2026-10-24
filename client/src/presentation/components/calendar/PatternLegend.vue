<script setup lang="ts">
import type { DayMark } from '../../../application/composables/usePatterns';
import { PATTERN_STYLE } from '../../categoryStyles';

// Consultation mode: what the marked days mean (TECH_SPEC.md use case 12).
const MARKS: readonly DayMark[] = ['watch', 'detected'];
</script>

<template>
  <ul
    aria-label="Leyenda del modo consulta"
    class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-800"
  >
    <li
      v-for="mark in MARKS"
      :key="mark"
      class="flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        class="grid h-5 w-5 place-items-center rounded-full"
        :class="PATTERN_STYLE[mark].surface"
      >
        <component
          :is="PATTERN_STYLE[mark].icon"
          :size="12"
        />
      </span>
      Días con «{{ PATTERN_STYLE[mark].label }}»
    </li>
  </ul>
</template>
