<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue';
import { useCalendar } from '../../../application/composables/useCalendar';
import { useGuestLimits } from '../../../application/composables/useGuestLimits';
import { FOCUS_RING } from '../../categoryStyles';

defineProps<{
  profileName: string;
}>();

const { monthLabel, canGoNext, isCurrentMonth, goPrevious, goNext, goToday } = useCalendar();
const { isGuest, canNavigateMonths, showLockedNotice } = useGuestLimits();

// Guests stay on the current month: a month change shows the locked notice instead (ADR-018).
function onPrevious(): void {
  if (canNavigateMonths.value) {
    goPrevious();
  } else {
    showLockedNotice();
  }
}

const ICON_BUTTON =
  'grid h-9 w-9 place-items-center text-slate-800 bg-tint rounded-full transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-tint';
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-widest text-slate">
        Historial de {{ profileName }}
      </p>
      <h2
        id="calendar-title"
        class="text-2xl font-semibold text-slate-800"
      >
        {{ monthLabel }}
      </h2>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        :disabled="isCurrentMonth"
        class="px-4 py-1.5 text-sm font-bold text-slate-800 border border-slate rounded-full transition-colors hover:bg-tint disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        :class="FOCUS_RING"
        @click="goToday"
      >
        Hoy
      </button>
      <button
        type="button"
        aria-label="Mes anterior"
        :aria-disabled="isGuest || undefined"
        :class="[ICON_BUTTON, FOCUS_RING, isGuest && 'opacity-50 cursor-not-allowed']"
        @click="onPrevious"
      >
        <ChevronLeft
          :size="18"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        aria-label="Mes siguiente"
        :disabled="!canGoNext"
        :class="[ICON_BUTTON, FOCUS_RING]"
        @click="goNext"
      >
        <ChevronRight
          :size="18"
          aria-hidden="true"
        />
      </button>
    </div>
  </header>
</template>
