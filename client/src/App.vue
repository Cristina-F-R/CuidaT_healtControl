<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { loadWorkspace } from './application/composables/useWorkspace';
import { useErrorBoundary } from './application/composables/useErrorBoundary';
import CalendarGrid from './presentation/components/calendar/CalendarGrid.vue';
import SidebarDock from './presentation/components/dock/SidebarDock.vue';
import AppToaster from './presentation/components/feedback/AppToaster.vue';
import FallbackError from './presentation/components/feedback/FallbackError.vue';
import FilterBar from './presentation/components/filters/FilterBar.vue';
import OverlayHost from './presentation/components/overlays/OverlayHost.vue';
import MonthlyInsightsSummary from './presentation/components/insights/MonthlyInsightsSummary.vue';
import AppHeader from './presentation/components/layout/AppHeader.vue';

const { criticalError } = useErrorBoundary();
const ready = ref(false);

// Errors thrown here reach app.config.errorHandler, which shows FallbackError.vue (ADR-009).
onMounted(async () => {
  await loadWorkspace();
  ready.value = true;
});
</script>

<template>
  <FallbackError v-if="criticalError" />
  <div
    v-else-if="ready"
    class="min-h-screen"
  >
    <AppHeader />
    <main class="mx-auto max-w-[1440px] px-4 pb-24 lg:px-8">
      <FilterBar />
      <!-- 3 columns from lg (1024px): dock 232px, calendar, insights 276px. Single column below. -->
      <div class="grid gap-4 lg:grid-cols-[232px_minmax(0,1fr)_276px] lg:items-start lg:gap-6">
        <SidebarDock />
        <CalendarGrid />
        <MonthlyInsightsSummary />
      </div>
    </main>
    <OverlayHost />
  </div>
  <p
    v-else
    class="p-6 text-sm font-bold text-slate"
  >
    Cargando…
  </p>
  <AppToaster />
</template>
