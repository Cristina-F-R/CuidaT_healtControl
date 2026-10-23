<script setup lang="ts">
import { computed } from 'vue';
import { useOverlays } from '../../../application/composables/useOverlays';
import type { EventLogCreateOverlay, EventLogEditOverlay } from '../../../application/composables/useOverlays';
import ItemManagerModal from '../catalog/ItemManagerModal.vue';
import AuthModal from '../auth/AuthModal.vue';
import DeleteAccountModal from '../auth/DeleteAccountModal.vue';
import DaySummaryModal from '../logs/DaySummaryModal.vue';
import EventLogModal from '../logs/EventLogModal.vue';

// Renders the topmost overlay of the stack (see useOverlays).
const { topOverlay } = useOverlays();

const eventLog = computed<EventLogCreateOverlay | EventLogEditOverlay | null>(() =>
  topOverlay.value?.kind === 'eventLog' ? topOverlay.value : null,
);
const daySummaryDayKey = computed<string | null>(() =>
  topOverlay.value?.kind === 'daySummary' ? topOverlay.value.dayKey : null,
);
</script>

<template>
  <EventLogModal
    v-if="eventLog"
    :key="`${eventLog.mode}-${eventLog.mode === 'create' ? eventLog.itemId + eventLog.dayKey : eventLog.logId}`"
    :request="eventLog"
  />
  <DaySummaryModal
    v-else-if="daySummaryDayKey"
    :day-key="daySummaryDayKey"
  />
  <ItemManagerModal v-else-if="topOverlay?.kind === 'itemManager'" />
  <AuthModal
    v-else-if="topOverlay?.kind === 'auth'"
    :initial-mode="topOverlay.mode"
  />
  <DeleteAccountModal v-else-if="topOverlay?.kind === 'deleteAccount'" />
</template>
