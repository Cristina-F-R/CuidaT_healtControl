<script setup lang="ts">
import type { ReportItem } from '@cuidat/shared';
import { CATEGORY_LABELS } from '../../../application/reportFormat';
import { CATEGORY_SURFACE } from '../../categoryStyles';

// Which emoji is which item in the mini calendars of a saved report (each emoji is one log).
defineProps<{
  items: ReportItem[];
}>();
</script>

<template>
  <div class="flex flex-col gap-1">
    <p class="text-xs text-slate">
      Cada icono es un registro de ese ítem.
    </p>
    <ul
      aria-label="Leyenda de ítems del informe"
      class="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-800"
    >
      <li
        v-for="item in items"
        :key="item.rootId"
        class="flex items-center gap-1.5"
      >
        <span
          aria-hidden="true"
          class="grid h-5 w-5 place-items-center rounded-md"
          :class="CATEGORY_SURFACE[item.category]"
        >{{ item.emoji }}</span>
        {{ item.name }}
        <span class="font-normal text-slate">({{ CATEGORY_LABELS[item.category] }})</span>
      </li>
    </ul>
  </div>
</template>
