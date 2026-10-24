<script setup lang="ts">
import type { HealthItemDefinition } from '@cuidat/shared';
import { FOCUS_RING } from '../../categoryStyles';

// A titled list of catalog items, each with one action that opens its edit or lifecycle view.
defineProps<{
  headingId: string;
  title: string;
  items: readonly HealthItemDefinition[];
  actionLabel: string;
  /** Archived items sit on a tinted surface. */
  tinted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', rootId: string): void;
}>();
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="flex flex-col gap-2"
    :class="tinted && 'p-3 bg-tint rounded-xl'"
  >
    <h3
      :id="headingId"
      class="text-sm font-extrabold text-slate-800"
    >
      {{ title }}
    </h3>
    <ul class="flex flex-col gap-1">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between gap-2"
      >
        <span class="flex min-w-0 items-center gap-2 text-sm text-slate-800"><span aria-hidden="true">{{ item.emoji }}</span><span class="truncate">{{ item.name }}</span></span>
        <button
          type="button"
          :aria-label="`${actionLabel} ${item.name}${tinted ? ' archivado' : ''}`"
          class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full"
          :class="[FOCUS_RING, tinted ? 'hover:bg-canvas' : 'hover:bg-tint']"
          @click="emit('select', item.rootId)"
        >
          {{ actionLabel }}
        </button>
      </li>
    </ul>
  </section>
</template>
