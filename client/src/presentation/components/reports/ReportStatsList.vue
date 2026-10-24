<script setup lang="ts">
import type { ReportSnapshot } from '@cuidat/shared';
import { computed } from 'vue';
import { CATEGORY_LABELS, reportItems, statsDetails } from '../../../application/reportFormat';
import { CATEGORY_SURFACE } from '../../categoryStyles';

// Statistics of each selected item in a saved report.
const props = defineProps<{
  snapshot: ReportSnapshot;
}>();

const rows = computed(() => {
  const items = reportItems(props.snapshot);
  return props.snapshot.itemStats.flatMap((stats) => {
    const item = items.get(stats.rootId);
    return item ? [{ item, lines: statsDetails(stats) }] : [];
  });
});
</script>

<template>
  <section
    aria-labelledby="report-stats"
    class="flex flex-col gap-3"
  >
    <h3
      id="report-stats"
      class="text-base font-extrabold text-slate-800"
    >
      Resumen por ítem
    </h3>
    <ul class="grid gap-2 sm:grid-cols-2">
      <li
        v-for="row in rows"
        :key="row.item.rootId"
        class="flex gap-3 p-3 bg-canvas border border-slate-100 rounded-xl"
      >
        <span
          aria-hidden="true"
          class="grid h-9 w-9 shrink-0 place-items-center text-lg rounded-lg"
          :class="CATEGORY_SURFACE[row.item.category]"
        >{{ row.item.emoji }}</span>
        <div class="min-w-0 text-sm text-slate-800">
          <p class="font-bold">
            {{ row.item.name }}
            <span class="text-xs font-normal text-slate">· {{ CATEGORY_LABELS[row.item.category] }}{{ row.item.archived ? ' · archivado' : '' }}</span>
          </p>
          <p
            v-for="line in row.lines"
            :key="line"
            class="text-xs"
          >
            {{ line }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>
