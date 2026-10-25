import type { HealthEventLog } from '@cuidat/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { createFakeServer } from '../../testing/fakeServer';
import type { FakeServer } from '../../testing/fakeServer';
import { useAuthStore } from '../stores/useAuthStore';
import { useCalendar } from './useCalendar';
import { resetMonthDensity, useMultiMonth } from './useMultiMonth';
import { usePatternDayMarks, usePatterns } from './usePatterns';
import { resetViewMode, useViewMode } from './useViewMode';
import { loadWorkspace } from './useWorkspace';

// Pescado -> Vómito three times (window 48 h): twice in September and once in October. Only the range
// that holds both months (2M) reaches the 3 occurrences of "Vigilar posible patrón".
const TRIGGER_DAYS = ['2026-09-10', '2026-09-20', '2026-10-05'] as const;

function seedPattern(server: FakeServer): void {
  const itemId = (name: string): string => server.items.find((item) => item.name === name)!.id;
  let n = 0;
  const log = (name: string, loggedAt: string): void => {
    const id = `33333333-3333-4333-8333-${String(++n).padStart(12, '0')}`;
    const instant = new Date(loggedAt).toISOString();
    const entry: HealthEventLog = {
      id, calendarId: server.profile.id, itemDefinitionId: itemId(name), loggedAt: instant,
      intensity: name === 'Vómito' ? 2 : null, durationMinutes: null, notes: null, createdAt: instant, updatedAt: instant,
    };
    server.logs.set(id, entry);
  };
  for (const day of TRIGGER_DAYS) {
    log('Pescado', `${day}T10:00:00`);
    log('Vómito', `${day}T12:00:00`);
  }
}

describe('patterns of the visible months (TECH_SPEC.md use case 12)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T12:00:00'));
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    resetMonthDensity();
    resetViewMode();
    useCalendar().goToday();
    const server = createFakeServer(true);
    seedPattern(server);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
  });

  afterEach(() => {
    resetMonthDensity();
    resetViewMode();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('counts only the active month at 1M and the whole stack at 2M', () => {
    const { watchPatterns } = usePatterns();
    expect(watchPatterns.value).toEqual([]);

    useMultiMonth().setDensity(2);

    expect(watchPatterns.value).toHaveLength(1);
    expect(watchPatterns.value[0]!.occurrences).toBe(3);
  });

  it('marks the trigger days of every visible month in consultation mode', () => {
    const dayMarks = usePatternDayMarks();
    useViewMode().setConsultationMode(true);
    expect(dayMarks.value.size).toBe(0);

    useMultiMonth().setDensity(2);

    expect([...dayMarks.value.entries()]).toEqual(TRIGGER_DAYS.map((day) => [day, 'watch']));
  });
});
