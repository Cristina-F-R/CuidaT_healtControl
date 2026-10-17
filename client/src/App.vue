<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { loadWorkspace, useMonthLoader, useWorkspaceLoadError, useWorkspaceReady } from './application/composables/useWorkspace';
import { useSyncStore } from './application/stores/useSyncStore';
import { useAuthStore } from './application/stores/useAuthStore';
import { useErrorBoundary } from './application/composables/useErrorBoundary';
import CalendarGrid from './presentation/components/calendar/CalendarGrid.vue';
import SidebarDock from './presentation/components/dock/SidebarDock.vue';
import AppToaster from './presentation/components/feedback/AppToaster.vue';
import FallbackError from './presentation/components/feedback/FallbackError.vue';
import FilterBar from './presentation/components/filters/FilterBar.vue';
import OverlayHost from './presentation/components/overlays/OverlayHost.vue';
import MonthlyInsightsSummary from './presentation/components/insights/MonthlyInsightsSummary.vue';
import AppHeader from './presentation/components/layout/AppHeader.vue';
import { FOCUS_RING } from './presentation/categoryStyles';

const { criticalError } = useErrorBoundary();
const ready = useWorkspaceReady();
const loadError = useWorkspaceLoadError();
useMonthLoader();

// Errors thrown here reach app.config.errorHandler, which shows FallbackError.vue (ADR-009).
onMounted(async () => {
  await useAuthStore().restoreSession();
  await loadWorkspace();
  // Offline queue (ADR-007): flush now and on online / visibility changes.
  useSyncStore().start();
});

onBeforeUnmount(() => useSyncStore().stop());
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
  <div
    v-else-if="loadError"
    role="alert"
    class="flex flex-col items-start gap-3 p-6 text-sm text-slate-800"
  >
    <p class="font-bold">
      No se pudieron cargar tus calendarios.
    </p>
    <p>{{ loadError }}</p>
    <button
      type="button"
      class="px-4 py-2 font-bold text-canvas bg-slate rounded-full hover:bg-slate-700"
      :class="FOCUS_RING"
      @click="loadWorkspace"
    >
      Reintentar
    </button>
  </div>
  <p
    v-else
    class="p-6 text-sm font-bold text-slate"
  >
    Cargando…
  </p>
  <AppToaster />
</template>
