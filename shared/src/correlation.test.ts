import { describe, expect, it } from 'vitest';
import { classifyOccurrences, detectCorrelations, markPatternDays } from './correlation.js';
import type { HealthEvent, ItemCategory, PatternThreshold } from './types.js';

const T0 = Date.parse('2026-04-01T00:00:00.000Z');
const HOUR = 3_600_000;

function at(hoursFromStart: number): string {
  return new Date(T0 + hoursFromStart * HOUR).toISOString();
}

function event(
  id: string,
  category: ItemCategory,
  hoursFromStart: number,
  rootItemId: string,
  createdAt: string = at(0),
): HealthEvent {
  return { id, itemDefinitionId: id, rootItemId, category, loggedAt: at(hoursFromStart), createdAt };
}

/** `count` symptom events, each preceded one hour earlier by its own trigger (window 2 h). */
function repeatedPair(count: number, triggerRoot = 'fish', symptomRoot = 'vomit'): HealthEvent[] {
  return Array.from({ length: count }, (_, index) => [
    event(`t-${index}`, 'trigger', index * 24, triggerRoot),
    event(`s-${index}`, 'symptom', index * 24 + 1, symptomRoot),
  ]).flat();
}

describe('classifyOccurrences', () => {
  it('reports nothing below 3 occurrences', () => {
    expect(classifyOccurrences(0)).toBeNull();
    expect(classifyOccurrences(2)).toBeNull();
  });

  it('flags 3 to 6 occurrences as a possible pattern', () => {
    expect(classifyOccurrences(3)).toBe('Vigilar posible patrón');
    expect(classifyOccurrences(6)).toBe('Vigilar posible patrón');
  });

  it('flags 7 or more occurrences as a detected pattern', () => {
    expect(classifyOccurrences(7)).toBe('Patrón detectado');
    expect(classifyOccurrences(12)).toBe('Patrón detectado');
  });
});

describe('detectCorrelations', () => {
  it('returns no patterns without events', () => {
    expect(detectCorrelations([], 48)).toEqual([]);
  });

  it('matches symptoms that follow a trigger inside the window', () => {
    expect(detectCorrelations(repeatedPair(3), 2)).toEqual([
      { triggerRootId: 'fish', symptomRootId: 'vomit', occurrences: 3, category: 'Vigilar posible patrón',
        symptomEventIds: ['s-0', 's-1', 's-2'], triggerEventIds: ['t-0', 't-1', 't-2'] },
    ]);
  });

  it('ignores symptoms that happen before the trigger', () => {
    const events = [
      event('s-1', 'symptom', 0, 'vomit'),
      event('t-1', 'trigger', 1, 'fish'),
      event('s-2', 'symptom', 2, 'vomit'),
      event('t-2', 'trigger', 3, 'fish'),
      event('t-3', 'trigger', 4, 'fish'),
    ];
    // Only s-2 follows a trigger (t-1), so the pair has one occurrence and is not reported.
    expect(detectCorrelations(events, 48)).toEqual([]);
  });

  it('ignores symptoms beyond the window', () => {
    const events = [event('t', 'trigger', 0, 'fish'), event('s', 'symptom', 6.5, 'vomit')];
    expect(detectCorrelations(events, 6)).toEqual([]);
  });

  it('keeps a symptom exactly at the window boundary', () => {
    const events = [0, 24, 48].flatMap((start) => [
      event(`t-${start}`, 'trigger', start, 'fish'),
      event(`s-${start}`, 'symptom', start + 6, 'vomit'),
    ]);
    expect(detectCorrelations(events, 6)[0]?.occurrences).toBe(3);
  });

  it('counts an identical instant as a match (trigger -> symptom order)', () => {
    const events = [0, 24, 48].flatMap((start) => [
      event(`t-${start}`, 'trigger', start, 'fish'),
      event(`s-${start}`, 'symptom', start, 'vomit'),
    ]);
    expect(detectCorrelations(events, 2)[0]?.occurrences).toBe(3);
  });

  it('counts a symptom once even when several triggers of the lineage match it', () => {
    const events = [
      event('t-1', 'trigger', 0, 'fish'),
      event('t-2', 'trigger', 1, 'fish'),
      event('s-1', 'symptom', 2, 'vomit'),
    ];
    expect(detectCorrelations(events, 6)).toEqual([]);

    const tripled = [
      ...events,
      event('t-3', 'trigger', 2, 'fish'),
      event('s-2', 'symptom', 3, 'vomit'),
      event('t-4', 'trigger', 3, 'fish'),
      event('s-3', 'symptom', 4, 'vomit'),
    ];
    expect(detectCorrelations(tripled, 6)[0]?.occurrences).toBe(3);
  });

  it('groups by lineage so edited versions count as the same item', () => {
    const events = [
      event('fish-v1', 'trigger', 0, 'fish'),
      event('fish-v2', 'trigger', 24, 'fish'),
      event('fish-v3', 'trigger', 48, 'fish'),
      event('vomit-v1', 'symptom', 1, 'vomit'),
      event('vomit-v2', 'symptom', 25, 'vomit'),
      event('vomit-v3', 'symptom', 49, 'vomit'),
    ];
    expect(detectCorrelations(events, 2)).toEqual([
      {
        triggerRootId: 'fish',
        symptomRootId: 'vomit',
        occurrences: 3,
        category: 'Vigilar posible patrón',
        symptomEventIds: ['vomit-v1', 'vomit-v2', 'vomit-v3'],
        triggerEventIds: ['fish-v1', 'fish-v2', 'fish-v3'],
      },
    ]);
  });

  it('treats medication as a trigger', () => {
    const events = repeatedPair(7, 'med', 'pain').map((item) =>
      item.category === 'trigger' ? { ...item, category: 'medication' as const } : item,
    );
    expect(detectCorrelations(events, 2)).toEqual([
      {
        triggerRootId: 'med',
        symptomRootId: 'pain',
        occurrences: 7,
        category: 'Patrón detectado',
        symptomEventIds: ['s-0', 's-1', 's-2', 's-3', 's-4', 's-5', 's-6'],
        triggerEventIds: ['t-0', 't-1', 't-2', 't-3', 't-4', 't-5', 't-6'],
      },
    ]);
  });

  it('does not report pairs with 2 occurrences and detects 7', () => {
    expect(detectCorrelations(repeatedPair(2), 2)).toEqual([]);
    expect(detectCorrelations(repeatedPair(7), 2)[0]?.category).toBe('Patrón detectado');
  });

  it('gives the same result for any input order, breaking ties by createdAt and then id', () => {
    const tied = [
      event('b', 'trigger', 0, 'fish', at(2)),
      event('a', 'trigger', 0, 'fish', at(1)),
      event('c', 'trigger', 0, 'milk', at(1)),
      event('s-1', 'symptom', 1, 'vomit', at(3)),
      event('s-2', 'symptom', 1, 'vomit', at(3)),
      event('s-0', 'symptom', 1, 'vomit', at(1)),
    ];
    const forward = detectCorrelations(tied, 2);
    expect(detectCorrelations([...tied].reverse(), 2)).toEqual(forward);
    // Identical instants: symptoms are listed by createdAt, then id.
    const symptomEventIds = ['s-0', 's-1', 's-2'];
    expect(forward).toEqual([
      { triggerRootId: 'fish', symptomRootId: 'vomit', occurrences: 3, category: 'Vigilar posible patrón', symptomEventIds, triggerEventIds: ['a', 'b'] },
      { triggerRootId: 'milk', symptomRootId: 'vomit', occurrences: 3, category: 'Vigilar posible patrón', symptomEventIds, triggerEventIds: ['c'] },
    ]);
  });

  it('lists only the symptoms that found a trigger, so occurrences equal their count', () => {
    const events = [...repeatedPair(3), event('lonely', 'symptom', 200, 'vomit')];
    const [pattern] = detectCorrelations(events, 2);
    expect(pattern?.symptomEventIds).toEqual(['s-0', 's-1', 's-2']);
    expect(pattern?.occurrences).toBe(pattern?.symptomEventIds.length);
  });

  it('lists each trigger behind the pattern once, in order, and leaves out triggers no symptom followed', () => {
    const events = [
      event('early', 'trigger', 0, 'fish'),
      event('t-1', 'trigger', 10, 'fish'),
      event('t-2', 'trigger', 10.5, 'fish'),
      event('s-1', 'symptom', 11, 'vomit'),
      event('s-2', 'symptom', 11.5, 'vomit'),
      event('t-3', 'trigger', 20, 'fish'),
      event('s-3', 'symptom', 21, 'vomit'),
    ];
    expect(detectCorrelations(events, 2)[0]?.triggerEventIds).toEqual(['t-1', 't-2', 't-3']);
  });

  it('handles identical duplicated events without double counting', () => {
    const duplicated = [
      event('t', 'trigger', 0, 'fish'),
      event('t', 'trigger', 0, 'fish'),
      event('s', 'symptom', 1, 'vomit'),
      event('s', 'symptom', 1, 'vomit'),
    ];
    expect(detectCorrelations(duplicated, 2)).toEqual([]);
  });
});

describe('markPatternDays (TECH_SPEC.md use case 12)', () => {
  const DAY_OF: Record<string, string> = { a: '2026-10-02', b: '2026-10-03', c: '2026-10-03', d: '2026-10-08' };
  const dayOf = (id: string): string | undefined => DAY_OF[id];
  const pattern = (category: PatternThreshold['category'], triggerEventIds: string[]): Pick<PatternThreshold, 'category' | 'triggerEventIds'> => ({
    category,
    triggerEventIds,
  });

  it('marks the days of the triggers behind each pattern, the possible cause', () => {
    expect([...markPatternDays([pattern('Vigilar posible patrón', ['a', 'b'])], dayOf)]).toEqual([
      ['2026-10-02', 'watch'],
      ['2026-10-03', 'watch'],
    ]);
  });

  it('gives "Patrón detectado" priority on a shared day, in any order', () => {
    const watch = pattern('Vigilar posible patrón', ['a', 'b']);
    const detected = pattern('Patrón detectado', ['c', 'd']);
    for (const patterns of [[watch, detected], [detected, watch]]) {
      const marks = markPatternDays(patterns, dayOf);
      expect(marks.get('2026-10-02')).toBe('watch');
      expect(marks.get('2026-10-03')).toBe('detected');
      expect(marks.get('2026-10-08')).toBe('detected');
    }
  });

  it('skips triggers whose day is unknown', () => {
    expect(markPatternDays([pattern('Patrón detectado', ['missing'])], dayOf).size).toBe(0);
  });
});
