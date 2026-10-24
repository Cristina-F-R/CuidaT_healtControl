<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMultiMonth } from '../../../application/composables/useMultiMonth';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import CalendarGrid from './CalendarGrid.vue';
import CalendarHeader from './CalendarHeader.vue';

// Header plus one grid per visible month, stacked (the active month first).
const { visibleMonthKeys, density } = useMultiMonth();
const { activeProfile } = storeToRefs(useProfileStore());
</script>

<template>
  <section
    aria-labelledby="calendar-title"
    class="flex min-w-0 flex-col gap-4 p-3 bg-canvas rounded-2xl border border-slate-100 shadow-sm sm:p-4 lg:p-6"
  >
    <CalendarHeader :profile-name="activeProfile.name" />
    <CalendarGrid
      v-for="monthKey in visibleMonthKeys"
      :key="monthKey"
      :month-key="monthKey"
      :show-title="density > 1"
    />
  </section>
</template>
