import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { monthPatternQuery } from './usePatterns';

// The marking rule itself (markPatternDays) is tested in shared/src/correlation.test.ts.
describe('consultation day marks (TECH_SPEC.md use case 12)', () => {
  it('queries the symptoms of the month and lets the window reach the previous one', () => {
    const query = monthPatternQuery('2026-10', 48);
    expect(query.from).toBe(dayjs('2026-10-01').valueOf());
    expect(query.to).toBe(dayjs('2026-10-01').endOf('month').valueOf());
    expect(query.windowHours).toBe(48);
  });
});
