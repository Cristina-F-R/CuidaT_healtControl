import { GUEST_LOCKED_WARNING } from '@cuidat/shared';
import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { createFakeServer } from '../../testing/fakeServer';
import { useAuthStore } from '../stores/useAuthStore';
import { buildSlots, useCalendar } from './useCalendar';
import { resetMonthDensity, useMultiMonth } from './useMultiMonth';
import { useToast } from './useToast';
import { loadWorkspace } from './useWorkspace';

const thisMonth = (): string => dayjs().format('YYYY-MM');

describe('multi-month density and month jumps (TECH_SPEC.md section 2)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    resetMonthDensity();
    useCalendar().goToday();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('locks guests at one month and shows the notice for 2M and 3M', async () => {
    await loadWorkspace();
    const multi = useMultiMonth();

    multi.setDensity(3);

    expect(multi.density.value).toBe(1);
    expect(multi.visibleMonthKeys.value).toEqual([thisMonth()]);
    expect(useToast().toasts.value.at(-1)?.message).toBe(GUEST_LOCKED_WARNING);
  });

  it('lets registered users stack up to three consecutive months, newest first', async () => {
    vi.stubGlobal('fetch', createFakeServer(true).fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    const multi = useMultiMonth();

    multi.setDensity(3);

    expect(multi.density.value).toBe(3);
    expect(multi.visibleMonthKeys.value).toEqual([
      thisMonth(),
      dayjs().subtract(1, 'month').format('YYYY-MM'),
      dayjs().subtract(2, 'month').format('YYYY-MM'),
    ]);
    expect(multi.oldestMonthKey.value).toBe(dayjs().subtract(2, 'month').format('YYYY-MM'));

    // Going back moves the whole window.
    useCalendar().goPrevious();
    expect(multi.visibleMonthKeys.value[0]).toBe(dayjs().subtract(1, 'month').format('YYYY-MM'));
    multi.setDensity(1);
    expect(multi.visibleMonthKeys.value).toHaveLength(1);
  });

  it('never jumps to a future month and ignores an invalid key', () => {
    const calendar = useCalendar();

    calendar.goToMonth(dayjs().add(1, 'month').format('YYYY-MM'));
    expect(calendar.activeMonthKey.value).toBe(thisMonth());

    calendar.goToMonth('2025-03');
    expect(calendar.activeMonthKey.value).toBe('2025-03');
    calendar.goToMonth('no-es-un-mes');
    expect(calendar.activeMonthKey.value).toBe('2025-03');
  });

  it('builds whole Monday-first weeks', () => {
    // October 2026 starts on a Thursday and has 31 days: 3 blanks + 31 days + 1 blank.
    const slots = buildSlots('2026-10');
    expect(slots).toHaveLength(35);
    expect(slots.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(slots.at(-1)).toBeNull();
  });
});
