<script setup lang="ts">
import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import { FOCUS_RING } from '../../categoryStyles';

// Each row shows the fields of the item version the log belongs to (TECH_SPEC.md use case 9).
const props = defineProps<{
  log: HealthEventLog;
  item: HealthItemDefinition;
  readOnly: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', logId: string): void;
  (e: 'delete', logId: string): void;
}>();

const INTENSITY_LABELS: Record<number, string> = { 1: 'Leve', 2: 'Moderada', 3: 'Grave' };

const time = computed(() => dayjs(props.log.loggedAt).format('HH:mm'));
const intensityLabel = computed(() =>
  props.item.trackIntensity && props.log.intensity !== null ? INTENSITY_LABELS[props.log.intensity] : null,
);
const durationLabel = computed(() =>
  props.item.trackDuration && props.log.durationMinutes !== null ? `${props.log.durationMinutes} min` : null,
);
const actionLabel = computed(() => `${props.item.name} a las ${time.value}`);
// Deleting a log is irreversible, so it takes a second, explicit click.
const confirmingDelete = ref(false);
</script>

<template>
  <li class="flex flex-col gap-1 p-3 bg-canvas border border-slate-100 rounded-xl">
    <div class="flex items-center justify-between gap-3">
      <p class="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-800">
        <span
          aria-hidden="true"
          class="text-lg"
        >{{ item.emoji }}</span>
        <span class="truncate">{{ item.name }}</span>
        <span class="shrink-0 text-xs font-normal text-slate">{{ time }}</span>
      </p>
      <div
        v-if="!readOnly"
        class="flex shrink-0 gap-1"
      >
        <button
          type="button"
          :aria-label="`Editar ${actionLabel}`"
          class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="emit('edit', log.id)"
        >
          Editar
        </button>
        <template v-if="confirmingDelete">
          <button
            type="button"
            class="px-2 py-1 text-xs font-bold text-canvas bg-danger hover:bg-danger-dark rounded-full transition-colors"
            :class="FOCUS_RING"
            @click="emit('delete', log.id)"
          >
            Sí, eliminar
          </button>
          <button
            type="button"
            class="px-2 py-1 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
            :class="FOCUS_RING"
            @click="confirmingDelete = false"
          >
            No
          </button>
        </template>
        <button
          v-else
          type="button"
          :aria-label="`Eliminar ${actionLabel}`"
          class="px-2 py-1 text-xs font-bold text-danger rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="confirmingDelete = true"
        >
          Eliminar
        </button>
      </div>
    </div>
    <p
      v-if="intensityLabel || durationLabel"
      class="text-xs font-bold text-slate-800"
    >
      <span v-if="intensityLabel">Intensidad: {{ intensityLabel }}</span>
      <span v-if="intensityLabel && durationLabel"> · </span>
      <span v-if="durationLabel">Duración: {{ durationLabel }}</span>
    </p>
    <p
      v-if="log.notes"
      class="text-sm text-slate-800 break-words"
    >
      {{ log.notes }}
    </p>
  </li>
</template>
