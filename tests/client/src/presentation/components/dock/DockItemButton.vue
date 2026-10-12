<script setup lang="ts">
import type { HealthItemDefinition } from '@cuidat/shared';
import { computed } from 'vue';
import { useInteraction } from '../../../application/composables/useInteraction';
import { CATEGORY_SURFACE, FOCUS_RING } from '../../categoryStyles';

const props = defineProps<{
  item: HealthItemDefinition;
}>();

const { selectedItemId, canDrag, toggleSelection, startDrag, endDrag } = useInteraction();

const isSelected = computed(() => selectedItemId.value === props.item.id);

function onDragStart(event: DragEvent): void {
  if (!event.dataTransfer) {
    return;
  }
  event.dataTransfer.effectAllowed = 'copy';
  event.dataTransfer.setData('text/plain', props.item.id);
  startDrag(props.item.id);
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="isSelected"
    :draggable="canDrag"
    class="flex w-full items-center gap-3 px-2 py-1.5 text-left text-sm font-bold rounded-xl transition-colors"
    :class="[FOCUS_RING, isSelected ? 'text-canvas bg-slate' : 'text-slate-800 hover:bg-tint']"
    @click="toggleSelection(item.id)"
    @dragstart="onDragStart"
    @dragend="endDrag"
  >
    <span
      aria-hidden="true"
      class="grid h-8 w-8 shrink-0 place-items-center text-lg rounded-lg"
      :class="CATEGORY_SURFACE[item.category]"
    >{{ item.emoji }}</span>
    <span class="min-w-0 break-words leading-tight">{{ item.name }}</span>
  </button>
</template>
