import { describe, expect, it } from 'vitest';
import { DomainRuleError } from './errors.js';
import { buildReportSnapshot, reportRange } from './reports.js';
import type { ReportInput } from './reports.js';
import { reportCreateSchema, reportSnapshotSchema } from './schemas.js';
import type { CalendarProfile, HealthEventLog, HealthItemDefinition, ItemCategory } from './types.js';

const ZONE = 'Europe/Madrid';
const CAL = '00000000-0000-4000-8000-000000000001';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const profile: CalendarProfile = {
  id: CAL, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'mint', correlationWindowHours: 2, createdAt: '2026-01-01T00:00:00.000Z',
};

function item(n: number, category: ItemCategory, overrides: Partial<HealthItemDefinition> = {}): HealthItemDefinition {
  return {
    id: uuid(n), calendarId: CAL, rootId: uuid(n), parentId: null, name: `Item ${n}`, emoji: '•', category,
    trackIntensity: true, trackDuration: true, status: 'active', createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  };
}

const FISH = item(10, 'trigger', { name: 'Pescado', emoji: '🐟' });
const VOMIT_V1 = item(11, 'symptom', { name: 'Vómito', emoji: '🤮', status: 'superseded', trackDuration: false });
const VOMIT_V2 = item(12, 'symptom', { rootId: uuid(11), parentId: uuid(11), name: 'Vómito', emoji: '🤮', trackIntensity: true, trackDuration: true });
const MILK = item(13, 'trigger', { name: 'Lácteos', emoji: '🥛', status: 'archived', trackIntensity: false, trackDuration: false });
const PAIN = item(14, 'symptom', { name: 'Malestar', emoji: '😣' });
const ITEMS = [FISH, VOMIT_V1, VOMIT_V2, MILK, PAIN];

let next = 100;
function log(target: HealthItemDefinition, loggedAt: string, overrides: Partial<HealthEventLog> = {}): HealthEventLog {
  next += 1;
  return {
    id: uuid(next), calendarId: CAL, itemDefinitionId: target.id, loggedAt, intensity: 2, durationMinutes: 30, notes: null,
    createdAt: loggedAt, updatedAt: loggedAt, ...overrides,
  };
}

/** Pescado -> Vómito one hour later, on `days` of October 2026 (local 10:00 and 11:00 in Madrid). */
function pairs(days: number[], symptom: HealthItemDefinition = VOMIT_V2, trigger: HealthItemDefinition = FISH): HealthEventLog[] {
  return days.flatMap((day) => {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    return [log(trigger, `${date}T08:00:00.000Z`), log(symptom, `${date}T09:00:00.000Z`)];
  });
}

function input(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    profile, items: ITEMS, logs: [], from: '2026-10-01', to: '2026-10-31', timeZone: ZONE,
    symptomRootIds: [uuid(11), uuid(14)], triggerRootIds: [uuid(10), uuid(13)], generatedAt: '2026-11-02T10:00:00.000Z', ...overrides,
  };
}

describe('buildReportSnapshot (TECH_SPEC.md section 9.1)', () => {
  it('freezes the calendar, the period, the selection (symptoms first) and the months', () => {
    const snapshot = buildReportSnapshot(input({ from: '2026-09-15', symptomRootIds: [uuid(11), uuid(11)] }));
    expect(reportSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.calendar).toEqual({ name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'mint', correlationWindowHours: 2 });
    expect(snapshot.period).toEqual({ from: '2026-09-15', to: '2026-10-31' });
    expect(snapshot.months).toEqual(['2026-09', '2026-10']);
    // One entry per lineage (the live version), duplicates removed, archived flagged.
    expect(snapshot.items.map((entry) => [entry.name, entry.category, entry.archived])).toEqual([
      ['Vómito', 'symptom', false],
      ['Pescado', 'trigger', false],
      ['Lácteos', 'trigger', true],
    ]);
  });

  it('reports patterns with the calendar window, detected first, and marks their days', () => {
    const logs = [...pairs([1, 2, 3]), ...pairs([4, 5, 6, 7, 8, 9, 10], PAIN, MILK)];
    const snapshot = buildReportSnapshot(input({ logs }));
    expect(snapshot.patterns).toEqual([
      { triggerRootId: uuid(13), symptomRootId: uuid(14), occurrences: 7, category: 'Patrón detectado' },
      { triggerRootId: uuid(10), symptomRootId: uuid(11), occurrences: 3, category: 'Vigilar posible patrón' },
    ]);
    expect(snapshot.days.find((day) => day.date === '2026-10-02')?.mark).toBe('watch');
    expect(snapshot.days.find((day) => day.date === '2026-10-08')?.mark).toBe('detected');
  });

  it('orders detected patterns by occurrences, and detected before watch whatever the engine order', () => {
    const logs = [...pairs([1, 2, 3, 4, 5, 6, 7]), ...pairs([8, 9, 10, 11, 12, 13, 14, 15], PAIN, MILK)];
    expect(buildReportSnapshot(input({ logs })).patterns.map((pattern) => pattern.occurrences)).toEqual([8, 7]);
    const detectedFirst = [...pairs([1, 2, 3, 4, 5, 6, 7], PAIN, MILK), ...pairs([20, 21, 22])];
    expect(buildReportSnapshot(input({ logs: detectedFirst })).patterns.map((pattern) => pattern.category)).toEqual([
      'Patrón detectado',
      'Vigilar posible patrón',
    ]);
  });

  it('names a lineage after its live version, whatever the order of the versions', () => {
    const snapshot = buildReportSnapshot(input({ items: [VOMIT_V2, { ...VOMIT_V1, name: 'Vómito antiguo' }, FISH, MILK, PAIN] }));
    expect(snapshot.items[0]?.name).toBe('Vómito');
  });

  it('marks the day of the trigger, the possible cause, and not the day of the symptom', () => {
    // 21:00 UTC is 23:00 in Madrid; the symptom at 22:30 UTC is already 00:30 of the next local day.
    const logs = [3, 5, 7].flatMap((day) => {
      const date = `2026-10-0${day}`;
      return [log(FISH, `${date}T21:00:00.000Z`), log(VOMIT_V2, `${date}T22:30:00.000Z`)];
    });
    const marks = Object.fromEntries(buildReportSnapshot(input({ logs })).days.map((day) => [day.date, day.mark]));
    expect(marks).toEqual({
      '2026-10-03': 'watch', '2026-10-04': null,
      '2026-10-05': 'watch', '2026-10-06': null,
      '2026-10-07': 'watch', '2026-10-08': null,
    });
  });

  it('groups by the local day and time of the time zone', () => {
    // 22:30 UTC on 31 October is 23:30 in Madrid (still October); 23:30 UTC on 1 October is 01:30 on the 2nd.
    const logs = [log(PAIN, '2026-10-31T22:30:00.000Z'), log(PAIN, '2026-10-01T23:30:00.000Z'), log(PAIN, '2026-10-31T23:30:00.000Z')];
    const snapshot = buildReportSnapshot(input({ logs }));
    expect(snapshot.days.map((day) => [day.date, day.logs.map((entry) => entry.time)])).toEqual([
      ['2026-10-02', ['01:30']],
      ['2026-10-31', ['23:30']],
    ]);
  });

  it('lets a trigger just before the period count, without listing it', () => {
    const logs = [
      log(FISH, '2026-09-30T21:30:00.000Z'), log(VOMIT_V2, '2026-09-30T22:30:00.000Z'), // 23:30 -> 00:30 on 1 October
      log(FISH, '2026-09-30T18:00:00.000Z'), // too early for the 2 h window
      ...pairs([2, 3]),
    ];
    const snapshot = buildReportSnapshot(input({ logs }));
    expect(snapshot.patterns[0]?.occurrences).toBe(3);
    expect(snapshot.days[0]?.date).toBe('2026-10-01');
    expect(snapshot.days[0]?.logs.map((entry) => entry.rootId)).toEqual([uuid(11)]);
  });

  it('leaves out unselected items, unknown versions and days outside the period', () => {
    const logs = [
      log(FISH, '2026-10-05T08:00:00.000Z'),
      log(PAIN, '2026-10-05T09:00:00.000Z'),
      log(item(99, 'symptom'), '2026-10-05T09:00:00.000Z'),
      log(FISH, '2026-11-05T08:00:00.000Z'),
    ];
    const snapshot = buildReportSnapshot(input({ logs, symptomRootIds: [], triggerRootIds: [uuid(10)] }));
    expect(snapshot.days).toEqual([{ date: '2026-10-05', mark: null, logs: [expect.objectContaining({ rootId: uuid(10), time: '10:00' })] }]);
  });

  it('computes statistics per item and drops metrics the item version does not track', () => {
    const logs = [
      log(VOMIT_V1, '2026-10-05T09:00:00.000Z', { intensity: 1, durationMinutes: 99, notes: 'Por la mañana' }),
      log(VOMIT_V2, '2026-10-06T09:00:00.000Z', { intensity: 3, durationMinutes: 20 }),
      log(VOMIT_V2, '2026-10-07T09:00:00.000Z', { intensity: 3, durationMinutes: 25 }),
      log(MILK, '2026-10-07T08:00:00.000Z', { intensity: 2, durationMinutes: 5 }),
      log(PAIN, '2026-10-08T09:00:00.000Z', { intensity: null, durationMinutes: null }),
    ];
    const snapshot = buildReportSnapshot(input({ logs }));
    const stats = Object.fromEntries(snapshot.itemStats.map((entry) => [entry.rootId, entry]));
    expect(stats[uuid(11)]).toEqual({
      rootId: uuid(11), logCount: 3, intensityCounts: [1, 0, 2], intensityMean: 2.3, durationTotalMinutes: 45, durationMeanMinutes: 22.5,
    });
    expect(stats[uuid(13)]).toEqual({
      rootId: uuid(13), logCount: 1, intensityCounts: null, intensityMean: null, durationTotalMinutes: null, durationMeanMinutes: null,
    });
    expect(stats[uuid(10)]?.logCount).toBe(0);
    expect(snapshot.days[0]?.logs[0]).toEqual({ time: '11:00', rootId: uuid(11), intensity: 1, durationMinutes: null, notes: 'Por la mañana' });
  });

  it('orders the logs of a day by instant, then createdAt, then id', () => {
    const same = '2026-10-05T09:00:00.000Z';
    const logs = [
      log(PAIN, same, { id: uuid(3), createdAt: '2026-10-05T09:00:02.000Z', notes: 'c' }),
      log(PAIN, same, { id: uuid(2), createdAt: '2026-10-05T09:00:01.000Z', notes: 'b' }),
      log(PAIN, same, { id: uuid(1), createdAt: '2026-10-05T09:00:01.000Z', notes: 'a' }),
      log(PAIN, '2026-10-05T08:00:00.000Z', { notes: 'first' }),
    ];
    expect(buildReportSnapshot(input({ logs })).days[0]?.logs.map((entry) => entry.notes)).toEqual(['first', 'a', 'b', 'c']);
  });

  it('refuses a selection that does not belong to the calendar or to the group', () => {
    const unknown = (): unknown => buildReportSnapshot(input({ symptomRootIds: [uuid(77)] }));
    const wrongGroup = (): unknown => buildReportSnapshot(input({ symptomRootIds: [uuid(10)] }));
    expect(unknown).toThrow(DomainRuleError);
    expect(wrongGroup).toThrow('no pertenece a este calendario');
  });
});

describe('reportRange', () => {
  it('loads from one window before the first local day to the last instant of the last one', () => {
    expect(reportRange('2026-10-01', '2026-10-31', ZONE, 48)).toEqual({
      from: new Date('2026-09-28T22:00:00.000Z'),
      to: new Date('2026-10-31T22:59:59.999Z'),
    });
  });
});

describe('reportCreateSchema', () => {
  const body = { calendarId: CAL, from: '2026-01-01', to: '2026-12-31', timeZone: ZONE, symptomRootIds: [uuid(11)], triggerRootIds: [] };

  it('accepts up to 12 months and trims the title', () => {
    expect(reportCreateSchema.parse({ ...body, title: '  Visita  ' }).title).toBe('Visita');
  });

  it('refuses reversed or longer periods, unknown zones and an empty selection', () => {
    expect(reportCreateSchema.safeParse({ ...body, from: '2026-12-31', to: '2026-01-01' }).success).toBe(false);
    expect(reportCreateSchema.safeParse({ ...body, from: '2025-12-31' }).success).toBe(false);
    expect(reportCreateSchema.safeParse({ ...body, timeZone: 'Mars/Olympus' }).success).toBe(false);
    expect(reportCreateSchema.safeParse({ ...body, symptomRootIds: [] }).success).toBe(false);
  });
});
