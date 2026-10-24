import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { markPatternDays, monthPatternQuery } from './usePatterns';
import type { PatternView } from './usePatterns';

function pattern(category: PatternView['category'], symptomEventIds: string[]): PatternView {
  return {
    key: `${category}-${symptomEventIds.join()}`,
    triggerLabel: 'Pescado',
    symptomLabel: 'Vómito',
    occurrences: symptomEventIds.length,
    category,
    symptomEventIds,
  };
}

const DAY_OF: Record<string, string> = {
  a: '2026-10-02',
  b: '2026-10-03',
  c: '2026-10-03',
  d: '2026-10-08',
};

describe('consultation day marks (TECH_SPEC.md use case 12)', () => {
  it('marks the days of the symptoms that make up each pattern', () => {
    const marks = markPatternDays([pattern('Vigilar posible patrón', ['a', 'b'])], (id) => DAY_OF[id]);
    expect([...marks]).toEqual([
      ['2026-10-02', 'watch'],
      ['2026-10-03', 'watch'],
    ]);
  });

  it('gives "Patrón detectado" priority on a day shared with a pattern to watch, in any order', () => {
    const watch = pattern('Vigilar posible patrón', ['a', 'b']);
    const detected = pattern('Patrón detectado', ['c', 'd']);
    for (const patterns of [[watch, detected], [detected, watch]]) {
      const marks = markPatternDays(patterns, (id) => DAY_OF[id]);
      expect(marks.get('2026-10-03')).toBe('detected');
      expect(marks.get('2026-10-02')).toBe('watch');
      expect(marks.get('2026-10-08')).toBe('detected');
    }
  });

  it('ignores symptoms whose log is no longer loaded', () => {
    expect(markPatternDays([pattern('Patrón detectado', ['missing'])], (id) => DAY_OF[id]).size).toBe(0);
  });

  it('queries the symptoms of the month and lets the window reach the previous one', () => {
    const query = monthPatternQuery('2026-10', 48);
    expect(query.from).toBe(dayjs('2026-10-01').valueOf());
    expect(query.to).toBe(dayjs('2026-10-01').endOf('month').valueOf());
    expect(query.windowHours).toBe(48);
  });
});
