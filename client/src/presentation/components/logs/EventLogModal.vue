<script setup lang="ts">
import dayjs from 'dayjs';
import { ref } from 'vue';
import { useEventLogForm } from '../../../application/composables/useEventLogForm';
import type { EventLogCreateOverlay, EventLogEditOverlay } from '../../../application/composables/useOverlays';
import { useOverlays } from '../../../application/composables/useOverlays';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';
import EventMetricFields from './EventMetricFields.vue';
import EventTimeField from './EventTimeField.vue';

const props = defineProps<{
  request: EventLogCreateOverlay | EventLogEditOverlay;
}>();

const { closeOverlay } = useOverlays();
const {
  isEdit,
  item,
  dayKey,
  time,
  timeMax,
  intensity,
  durationText,
  notes,
  errorMessage,
  save,
  remove,
} = useEventLogForm(props.request);

const dayLabel = dayjs(dayKey).format('dddd D [de] MMMM');
const confirmingDelete = ref(false);

async function onSave(): Promise<void> {
  if (await save()) {
    closeOverlay();
  }
}

async function onRemove(): Promise<void> {
  await remove();
  closeOverlay();
}
</script>

<template>
  <AppModal
    :title="isEdit ? 'Editar registro' : 'Nuevo registro'"
    @close="closeOverlay"
  >
    <p
      v-if="item"
      class="flex items-center gap-2 text-sm font-bold text-slate-800"
    >
      <span
        aria-hidden="true"
        class="text-lg"
      >{{ item.emoji }}</span>
      {{ item.name }} · {{ dayLabel }}
    </p>
    <p
      v-else
      role="alert"
      class="text-sm font-bold text-danger-dark"
    >
      El ítem ya no existe.
    </p>

    <form
      novalidate
      class="flex flex-col gap-5"
      @submit.prevent="onSave"
    >
      <EventTimeField
        v-model="time"
        :max="timeMax"
      />
      <EventMetricFields
        :track-intensity="item?.trackIntensity ?? false"
        :track-duration="item?.trackDuration ?? false"
        :intensity="intensity"
        :duration-text="durationText"
        :notes="notes"
        @update:intensity="intensity = $event"
        @update:duration-text="durationText = $event"
        @update:notes="notes = $event"
      />

      <p
        v-if="errorMessage"
        role="alert"
        class="text-sm font-bold text-danger-dark"
      >
        {{ errorMessage }}
      </p>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <div
          v-if="isEdit && confirmingDelete"
          class="flex items-center gap-2 text-sm font-bold text-slate-800"
        >
          ¿Eliminar este registro?
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-bold text-canvas bg-danger hover:bg-danger-dark rounded-full transition-colors"
            :class="FOCUS_RING"
            @click="onRemove"
          >
            Sí, eliminar
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-bold text-slate-800 rounded-full hover:bg-tint"
            :class="FOCUS_RING"
            @click="confirmingDelete = false"
          >
            No
          </button>
        </div>
        <button
          v-else-if="isEdit"
          type="button"
          class="px-3 py-2 text-sm font-bold text-danger rounded-full hover:bg-tint"
          :class="FOCUS_RING"
          @click="confirmingDelete = true"
        >
          Eliminar registro
        </button>
        <span v-else />
        <div class="flex gap-2">
          <button
            type="button"
            class="px-4 py-2 text-sm font-bold text-slate-800 border border-slate rounded-full hover:bg-tint"
            :class="FOCUS_RING"
            @click="closeOverlay"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="!item"
            class="px-4 py-2 text-sm font-bold text-canvas bg-slate rounded-full transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            :class="FOCUS_RING"
          >
            Guardar
          </button>
        </div>
      </div>
    </form>
  </AppModal>
</template>
