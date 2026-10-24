<script setup lang="ts">
import dayjs from 'dayjs';
import { computed } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import { useEventStore } from '../../../application/stores/useEventStore';
import { useItemDefinitionStore } from '../../../application/stores/useItemDefinitionStore';
import AppModal from '../feedback/AppModal.vue';
import DaySummaryRow from './DaySummaryRow.vue';

// Consultation mode (TECH_SPEC.md use case 12): every detail of a log, without editing or deleting.
const props = defineProps<{
  logId: string;
}>();

const { closeOverlay } = useOverlays();
const eventStore = useEventStore();
const itemStore = useItemDefinitionStore();

const log = computed(() => eventStore.logs.find((candidate) => candidate.id === props.logId));
const item = computed(() => (log.value ? itemStore.findById(log.value.itemDefinitionId) : undefined));
const dayLabel = computed(() => (log.value ? dayjs(log.value.loggedAt).format('dddd D [de] MMMM [de] YYYY') : ''));
</script>

<template>
  <AppModal
    title="Detalle del registro"
    @close="closeOverlay"
  >
    <template v-if="log && item">
      <p class="text-sm font-bold text-slate">
        {{ dayLabel }}
      </p>
      <ul>
        <DaySummaryRow
          :log="log"
          :item="item"
          :read-only="true"
        />
      </ul>
    </template>
    <p
      v-else
      role="alert"
      class="text-sm font-bold text-danger-dark"
    >
      El registro ya no existe.
    </p>
  </AppModal>
</template>
