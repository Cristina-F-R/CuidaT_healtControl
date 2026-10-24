import type { HealthEventLog } from '@cuidat/shared';
import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDataLayerForTests } from '../../infrastructure/repositories/createRepositories';
import { createMemoryStore } from '../../infrastructure/sync/keyValueStore';
import { callsOf } from '../../testing/fakeApi';
import { createFakeServer } from '../../testing/fakeServer';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useCorrelationFilter } from './useCorrelationFilter';
import { loadWorkspace } from './useWorkspace';

let counter = 0;

function log(itemId: string, calendarId: string, loggedAt: dayjs.Dayjs): HealthEventLog {
  const iso = loggedAt.toISOString();
  return {
    id: `55555555-5555-4555-8555-${String(++counter).padStart(12, '0')}`,
    calendarId,
    itemDefinitionId: itemId,
    loggedAt: iso,
    intensity: 1,
    durationMinutes: null,
    notes: null,
    createdAt: iso,
    updatedAt: iso,
  };
}

describe('correlation filter (TECH_SPEC.md use case 3)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Pescado -> Vómito three times and Lácteos -> Vómito seven times, one hour apart. */
  async function seed(): Promise<ReturnType<typeof createFakeServer>> {
    const server = createFakeServer(true);
    vi.stubGlobal('fetch', server.fetch);
    await useAuthStore().restoreSession();
    await loadWorkspace();
    const items = useItemDefinitionStore();
    const named = (name: string): string => items.items.find((item) => item.name === name)!.id;
    const calendarId = server.profile.id;
    const logs: HealthEventLog[] = [];
    for (let day = 1; day <= 7; day += 1) {
      const start = dayjs().subtract(day, 'day').startOf('day').add(9, 'hour');
      logs.push(log(named('Lácteos'), calendarId, start), log(named('Vómito'), calendarId, start.add(1, 'hour')));
      if (day <= 3) {
        logs.push(log(named('Pescado'), calendarId, start.add(2, 'hour')), log(named('Vómito'), calendarId, start.add(3, 'hour')));
      }
    }
    useEventStore().logs = logs;
    return server;
  }

  it('classifies pairs by threshold and recalculates when a trigger is deselected', async () => {
    await seed();
    const filter = useCorrelationFilter();

    expect(filter.detectedPatterns.value.map((pattern) => pattern.triggerLabel)).toEqual(['🥛 Lácteos']);
    expect(filter.watchPatterns.value.map((pattern) => `${pattern.triggerLabel} → ${pattern.symptomLabel}`)).toEqual(['🐟 Pescado → 🤢 Vómito']);

    const lácteos = filter.triggerOptions.value.find((option) => option.label.includes('Lácteos'))!;
    filter.toggle('triggers', lácteos.rootId);
    expect(filter.detectedPatterns.value).toEqual([]);

    filter.selectAll('triggers');
    expect(filter.detectedPatterns.value).toHaveLength(1);
  });

  it('keeps only the selected symptoms and shrinks with the period', async () => {
    await seed();
    const filter = useCorrelationFilter();

    filter.selectedSymptoms.value = new Set();
    expect(filter.watchPatterns.value).toEqual([]);
    expect(filter.detectedPatterns.value).toEqual([]);

    filter.selectAll('symptoms');
    // Only the last 3 days: 3 Lácteos pairs and 3 Pescado pairs are left.
    filter.from.value = dayjs().subtract(3, 'day').format('YYYY-MM-DD');
    expect(filter.detectedPatterns.value).toEqual([]);
    expect(filter.watchPatterns.value).toHaveLength(2);
  });

  it('offers archived lineages and fetches the range that a long period is missing', async () => {
    const server = await seed();
    const items = useItemDefinitionStore();
    items.items = items.items.map((item) => (item.name === 'Pescado' ? { ...item, status: 'archived' as const } : item));
    const filter = useCorrelationFilter();
    expect(filter.triggerOptions.value.find((option) => option.label.includes('Pescado'))?.archived).toBe(true);

    const before = callsOf(server.fetch).length;
    filter.applyPreset(12);
    await vi.waitFor(() => expect(filter.loading.value).toBe(false));

    const requested = callsOf(server.fetch).slice(before).filter((call) => call.startsWith('GET') && call.endsWith('/events'));
    expect(requested).toHaveLength(1);
  });

  it('locks the period for guests at the current month', async () => {
    await loadWorkspace();
    const filter = useCorrelationFilter();

    expect(filter.periodLocked.value).toBe(true);
    expect(filter.from.value).toBe(dayjs().startOf('month').format('YYYY-MM-DD'));
  });
});
