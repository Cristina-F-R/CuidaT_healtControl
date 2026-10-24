import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';
import { useAuthStore } from '../stores/useAuthStore';
import { monthsBefore, useCalendar } from './useCalendar';
import { useGuestLimits } from './useGuestLimits';

export type MonthDensity = 1 | 2 | 3;

export const MONTH_DENSITIES: readonly MonthDensity[] = [1, 2, 3];

// Shared by the selector, the panel and the month loader.
const density = ref<MonthDensity>(1);

/** Back to one month (sign-out, account deletion): guests are locked at `1M` (ADR-018). */
export function resetMonthDensity(): void {
  density.value = 1;
}

export interface MultiMonth {
  density: ComputedRef<MonthDensity>;
  /** The active month first, then the previous ones (never a future month). */
  visibleMonthKeys: ComputedRef<string[]>;
  /** Oldest visible month: the one that decides how far back the logs must be loaded. */
  oldestMonthKey: ComputedRef<string>;
  setDensity: (next: MonthDensity) => void;
}

/** Multi-month density `[1M | 2M | 3M]` (TECH_SPEC.md section 2). */
export function useMultiMonth(): MultiMonth {
  const { activeMonthKey } = useCalendar();
  const { isGuest, showLockedNotice } = useGuestLimits();

  const effectiveDensity = computed<MonthDensity>(() => (useAuthStore().isGuest ? 1 : density.value));
  const visibleMonthKeys = computed(() =>
    Array.from({ length: effectiveDensity.value }, (_, index) => monthsBefore(activeMonthKey.value, index)),
  );

  function setDensity(next: MonthDensity): void {
    if (isGuest.value && next !== 1) {
      showLockedNotice();
      return;
    }
    density.value = next;
  }

  return {
    density: effectiveDensity,
    visibleMonthKeys,
    oldestMonthKey: computed(() => visibleMonthKeys.value[visibleMonthKeys.value.length - 1] ?? activeMonthKey.value),
    setDensity,
  };
}
