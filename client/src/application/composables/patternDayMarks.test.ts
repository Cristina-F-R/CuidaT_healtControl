import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { visiblePatternQuery } from './usePatterns';

// The marking rule itself (markPatternDays) is tested in shared/src/correlation.test.ts.
describe('pattern query of the visible months (TECH_SPEC.md use case 12)', () => {
  it('queries the symptoms of a single month and lets the window reach the previous one', () => {
    const query = visiblePatternQuery(['2026-10'], 48);
    expect(query.from).toBe(dayjs('2026-10-01').valueOf());
    expect(query.to).toBe(dayjs('2026-10-01').endOf('month').valueOf());
    expect(query.windowHours).toBe(48);
  });

  it('spans every stacked month (3M), from the oldest to the end of the active one', () => {
    // visibleMonthKeys lists the active month first.
    const query = visiblePatternQuery(['2026-10', '2026-09', '2026-08'], 24);
    expect(query.from).toBe(dayjs('2026-08-01').valueOf());
    expect(query.to).toBe(dayjs('2026-10-01').endOf('month').valueOf());
  });

  it('crosses the year boundary', () => {
    const query = visiblePatternQuery(['2027-01', '2026-12'], 24);
    expect(query.from).toBe(dayjs('2026-12-01').valueOf());
    expect(query.to).toBe(dayjs('2027-01-01').endOf('month').valueOf());
  });
});
