<script setup lang="ts">
import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useEventStore } from '../../../application/stores/useEventStore';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useViewMode } from '../../../application/composables/useViewMode';
import AppModal from '../feedback/AppModal.vue';
import DaySummaryRow from './DaySummaryRow.vue';

const props = defineProps<{
  dayKey: string;
}>();

const { openOverlay, closeOverlay } = useOverlays();
const eventStore = useEventStore();
const itemStore = useItemDefinitionStore();
const { logsByDay } = storeToRefs(eventStore);

/** Consultation mode is global (TECH_SPEC.md use cases 5 and 12): it makes the summary read-only. */
const { consultationMode } = useViewMode();

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
    <p class="text-sm text-slate">
      {{ entries.length === 0 ? 'Sin registros este día.' : `${entries.length} ${entries.length === 1 ? 'registro' : 'registros'}` }}
    </p>

    <ol class="flex flex-col gap-2">
      <DaySummaryRow
        v-for="entry in entries"
        :key="entry.log.id"
        :log="entry.log"
        :item="entry.item"
        :read-only="consultationMode"
        @edit="openOverlay({ kind: 'eventLog', mode: 'edit', logId: $event })"
        @delete="removeLog"
      />
    </ol>
  </AppModal>
</template>
