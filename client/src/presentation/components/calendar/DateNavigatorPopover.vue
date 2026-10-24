<script setup lang="ts">
import { ChevronDown, ChevronLeft, ChevronRight } from '@lucide/vue';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useCalendar } from '../../../application/composables/useCalendar';
import { useDisclosure } from '../../../application/composables/useDisclosure';
import { useGuestLimits } from '../../../application/composables/useGuestLimits';
import { FOCUS_RING } from '../../categoryStyles';

// Quick Jump Navigator (TECH_SPEC.md section 2): the month label opens a year stepper and a grid of
// 12 months. Guests are locked (ADR-018) and future months are never selectable (use case 8).
const { activeMonthKey, monthLabel, goToMonth } = useCalendar();
const { isGuest, showLockedNotice } = useGuestLimits();
const disclosure = useDisclosure();
const { open, panelId, close } = disclosure;

const year = ref(dayjs(`${activeMonthKey.value}-01`).year());
const currentYear = dayjs().year();
const activeYear = computed(() => dayjs(`${activeMonthKey.value}-01`).year());
const MONTHS = Array.from({ length: 12 }, (_, index) => dayjs().month(index).format('MMM'));

// Each time the popover opens it starts on the year being viewed.
watch(open, (isOpen) => {
  if (isOpen) {
    year.value = activeYear.value;
  }
});

function onToggle(): void {
  if (isGuest.value) {
    showLockedNotice();
    return;
  }
  open.value = !open.value;
}

function monthKeyOf(index: number): string {
  return `${year.value}-${String(index + 1).padStart(2, '0')}`;
}

function isFutureMonth(index: number): boolean {
  return dayjs(`${monthKeyOf(index)}-01`).isAfter(dayjs(), 'month');
}

function pick(index: number): void {
  goToMonth(monthKeyOf(index));
  close(true);
}

const STEP =
  'grid h-8 w-8 place-items-center text-slate-800 bg-tint rounded-full hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<template>
  <div
    :ref="disclosure.rootRef"
    class="relative"
    @keydown.esc="close(true)"
  >
    <button
      :ref="disclosure.toggleRef"
      type="button"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-disabled="isGuest || undefined"
      aria-label="Elegir mes y año"
      class="inline-flex items-center gap-1 text-2xl font-semibold text-slate-800 rounded-lg"
      :class="[FOCUS_RING, isGuest && 'cursor-not-allowed opacity-70']"
      @click="onToggle"
    >
      {{ monthLabel }}
      <ChevronDown
        :size="18"
        aria-hidden="true"
      />
    </button>
    <div
      v-show="open"
      :id="panelId"
      role="group"
      aria-label="Saltar a un mes"
      class="absolute left-0 z-30 mt-2 flex w-64 flex-col gap-3 p-3 bg-canvas border border-slate-200 rounded-2xl shadow-xl"
    >
      <div class="flex items-center justify-between">
        <button
          type="button"
          aria-label="Año anterior"
          :class="[STEP, FOCUS_RING]"
          @click="year -= 1"
        >
          <ChevronLeft
            :size="16"
            aria-hidden="true"
          />
        </button>
        <span
          aria-live="polite"
          class="text-sm font-extrabold text-slate-800"
        >{{ year }}</span>
        <button
          type="button"
          aria-label="Año siguiente"
          :disabled="year >= currentYear"
          :class="[STEP, FOCUS_RING]"
          @click="year += 1"
        >
          <ChevronRight
            :size="16"
            aria-hidden="true"
          />
        </button>
      </div>
      <ul class="grid grid-cols-3 gap-1">
        <li
          v-for="(label, index) in MONTHS"
          :key="label"
        >
          <button
            type="button"
            :disabled="isFutureMonth(index)"
            :aria-pressed="monthKeyOf(index) === activeMonthKey"
            class="w-full px-2 py-1.5 text-sm font-bold capitalize rounded-lg disabled:cursor-not-allowed disabled:opacity-40"
            :class="[
              FOCUS_RING,
              monthKeyOf(index) === activeMonthKey ? 'text-canvas bg-slate' : 'text-slate-800 bg-tint hover:bg-slate-100',
            ]"
            @click="pick(index)"
          >
            {{ label }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
