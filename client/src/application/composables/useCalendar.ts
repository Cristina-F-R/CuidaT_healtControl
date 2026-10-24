import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';

const MONTH_KEY_FORMAT = 'YYYY-MM';
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DAY_KEY_FORMAT = 'YYYY-MM-DD';

/** A day of the active month (`YYYY-MM-DD`) or `null` for the padding before/after it. */
export type CalendarSlot = string | null;

// Shared by the calendar header, the grid and the insights panel.
const activeMonthKey = ref(dayjs().format(MONTH_KEY_FORMAT));

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Days of a month (`YYYY-MM`) padded with `null` to whole weeks that start on Monday. */
export function buildSlots(monthKey: string): CalendarSlot[] {
  const first = dayjs(`${monthKey}-01`);
  const leadingBlanks = (first.day() + 6) % 7;
  const days = Array.from({ length: first.daysInMonth() }, (_, index) => first.add(index, 'day').format(DAY_KEY_FORMAT));
  const trailingBlanks = (7 - ((leadingBlanks + days.length) % 7)) % 7;
  return [...Array<null>(leadingBlanks).fill(null), ...days, ...Array<null>(trailingBlanks).fill(null)];
}

/** «Septiembre 2026» */
export function monthLabelOf(monthKey: string): string {
  return capitalize(dayjs(`${monthKey}-01`).format('MMMM YYYY'));
}

/** The month key `count` months before `monthKey`. */
export function monthsBefore(monthKey: string, count: number): string {
  return dayjs(`${monthKey}-01`).subtract(count, 'month').format(MONTH_KEY_FORMAT);
}

export interface CalendarState {
  activeMonthKey: ComputedRef<string>;
  monthLabel: ComputedRef<string>;
  monthName: ComputedRef<string>;
  slots: ComputedRef<CalendarSlot[]>;
  canGoNext: ComputedRef<boolean>;
  isCurrentMonth: ComputedRef<boolean>;
  goPrevious: () => void;
  goNext: () => void;
  goToday: () => void;
  /** Jumps to a month; a future month is never reachable (TECH_SPEC.md use case 8). */
  goToMonth: (monthKey: string) => void;
}

export function useCalendar(): CalendarState {
  const activeMonth = computed(() => dayjs(`${activeMonthKey.value}-01`));
  const currentMonthKey = (): string => dayjs().format(MONTH_KEY_FORMAT);

  const isCurrentMonth = computed(() => activeMonthKey.value === currentMonthKey());
  // Future months are never reachable (TECH_SPEC.md use case 8).
  const canGoNext = computed(() => activeMonth.value.isBefore(dayjs(), 'month'));

  const slots = computed<CalendarSlot[]>(() => buildSlots(activeMonthKey.value));

  function goPrevious(): void {
    activeMonthKey.value = activeMonth.value.subtract(1, 'month').format(MONTH_KEY_FORMAT);
  }

  function goNext(): void {
    if (canGoNext.value) {
      activeMonthKey.value = activeMonth.value.add(1, 'month').format(MONTH_KEY_FORMAT);
    }
  }

  function goToday(): void {
    activeMonthKey.value = currentMonthKey();
  }

  function goToMonth(monthKey: string): void {
    const target = dayjs(`${monthKey}-01`);
    if (MONTH_KEY_PATTERN.test(monthKey) && !target.isAfter(dayjs(), 'month')) {
      activeMonthKey.value = target.format(MONTH_KEY_FORMAT);
    }
  }

  return {
    activeMonthKey: computed(() => activeMonthKey.value),
    monthLabel: computed(() => monthLabelOf(activeMonthKey.value)),
    monthName: computed(() => activeMonth.value.format('MMMM')),
    slots,
    canGoNext,
    isCurrentMonth,
    goPrevious,
    goNext,
    goToday,
    goToMonth,
  };
}
