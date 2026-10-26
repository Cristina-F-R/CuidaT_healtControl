<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useMultiMonth } from '../../../application/composables/useMultiMonth';
import { usePatternDayMarks } from '../../../application/composables/usePatterns';
import { useViewMode } from '../../../application/composables/useViewMode';
import { useProfileStore } from '../../../application/stores/useProfileStore';
import { PROFILE_THEME } from '../../categoryStyles';
import CalendarGrid from './CalendarGrid.vue';
import CalendarHeader from './CalendarHeader.vue';
import PatternLegend from './PatternLegend.vue';

// Header plus one grid per visible month, stacked (the active month first). The top band shows the
// calendar's color theme, so the open calendar is recognized at a glance (TECH_SPEC.md use case 6).
const { visibleMonthKeys, density } = useMultiMonth();
const { activeProfile } = storeToRefs(useProfileStore());
const { consultationMode } = useViewMode();
// Consultation mode only (empty otherwise): pattern days of all the visible months, computed once (use case 12).
const dayMarks = usePatternDayMarks();
</script>

<template>
  <section
    aria-labelledby="calendar-title"
    class="flex min-w-0 flex-col gap-4 p-3 bg-canvas rounded-2xl border border-t-4 border-slate-100 shadow-sm sm:p-4 lg:p-6"
    :class="PROFILE_THEME[activeProfile.colorTheme].band"
  >
    <CalendarHeader :profile-name="activeProfile.name" />
    <PatternLegend v-if="consultationMode" />
    <CalendarGrid
      v-for="monthKey in visibleMonthKeys"
      :key="monthKey"
      :month-key="monthKey"
      :show-title="density > 1"
      :day-marks="dayMarks"
    />
  </section>
</template>
