<script setup lang="ts">
import { useErrorBoundary } from './application/composables/useErrorBoundary';
import CalendarGrid from './presentation/components/calendar/CalendarGrid.vue';
import SidebarDock from './presentation/components/dock/SidebarDock.vue';
import AppToaster from './presentation/components/feedback/AppToaster.vue';
import FallbackError from './presentation/components/feedback/FallbackError.vue';
import FilterBar from './presentation/components/filters/FilterBar.vue';
import MonthlyInsightsSummary from './presentation/components/insights/MonthlyInsightsSummary.vue';
import AppHeader from './presentation/components/layout/AppHeader.vue';

const { criticalError } = useErrorBoundary();
</script>

<template>
  <FallbackError v-if="criticalError" />
  <div
    v-else
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
  </div>
  <AppToaster />
</template>
