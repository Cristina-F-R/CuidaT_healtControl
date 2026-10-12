<script setup lang="ts">
import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useEventStore } from '../../../application/stores/useEventStore';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import { useOverlays } from '../../../application/composables/useOverlays';
import AppModal from '../feedback/AppModal.vue';
import { FOCUS_RING } from '../../categoryStyles';
import DaySummaryRow from './DaySummaryRow.vue';

const props = defineProps<{
  dayKey: string;
}>();

const { openOverlay, closeOverlay } = useOverlays();
const eventStore = useEventStore();
const itemStore = useItemDefinitionStore();
const { logsByDay } = storeToRefs(eventStore);

/** Consultation mode (medical visits): read-only, editing actions are suppressed (TECH_SPEC.md use case 5). */
const consultation = ref(false);

interface SummaryEntry {
  log: HealthEventLog;
  item: HealthItemDefinition;
}

const entries = computed<SummaryEntry[]>(() =>
  (logsByDay.value.get(props.dayKey) ?? []).flatMap((log) => {
    const item = itemStore.findById(log.itemDefinitionId);
    return item ? [{ log, item }] : [];
  }),
);

const dayLabel = dayjs(props.dayKey).format('D [de] MMMM [de] YYYY');

async function removeLog(logId: string): Promise<void> {
  await eventStore.removeLog(logId);
}
</script>

<template>
  <AppModal
    :title="dayLabel"
    @close="closeOverlay"
  >
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate">
        {{ entries.length === 0 ? 'Sin registros este día.' : `${entries.length} ${entries.length === 1 ? 'registro' : 'registros'}` }}
      </p>
      <button
        type="button"
        role="switch"
        :aria-checked="consultation"
        class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-800 rounded-full"
        :class="[FOCUS_RING, consultation ? 'bg-mint' : 'bg-tint']"
        @click="consultation = !consultation"
      >
        <span
          aria-hidden="true"
          class="inline-block h-5 w-9 rounded-full transition-colors"
          :class="consultation ? 'bg-slate-700' : 'bg-slate-300'"
        />
        Modo consulta
      </button>
    </div>

    <ol class="flex flex-col gap-2">
      <DaySummaryRow
        v-for="entry in entries"
        :key="entry.log.id"
        :log="entry.log"
        :item="entry.item"
        :read-only="consultation"
        @edit="openOverlay({ kind: 'eventLog', mode: 'edit', logId: $event })"
        @delete="removeLog"
      />
    </ol>
  </AppModal>
</template>
