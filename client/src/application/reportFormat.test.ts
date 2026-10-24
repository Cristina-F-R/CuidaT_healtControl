import { buildReportSnapshot } from '@cuidat/shared';
import type { CalendarProfile, HealthEventLog, HealthItemDefinition, ReportItemStats } from '@cuidat/shared';
import { describe, expect, it } from 'vitest';
import { logDetails, miniMonth, reportFileName, statsDetails } from './reportFormat';

const CAL = '00000000-0000-4000-8000-000000000001';
const profile: CalendarProfile = {
  id: CAL, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'slate', correlationWindowHours: 2, createdAt: '2026-01-01T00:00:00.000Z',
};
const item = (n: number, category: HealthItemDefinition['category']): HealthItemDefinition => {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return { id, calendarId: CAL, rootId: id, parentId: null, name: `Item ${n}`, emoji: '•', category, trackIntensity: true, trackDuration: true, status: 'active', createdAt: profile.createdAt };
};

describe('report wording (TECH_SPEC.md section 9.1)', () => {
  it('describes a log and the statistics of an item in Spanish', () => {
    expect(logDetails({ time: '09:00', rootId: 'x', intensity: 2, durationMinutes: 20, notes: null })).toBe('Intensidad: Moderada · Duración: 20 min');
    expect(logDetails({ time: '09:00', rootId: 'x', intensity: null, durationMinutes: null, notes: 'a' })).toBe('');
    const stats: ReportItemStats = {
      rootId: 'x', logCount: 3, intensityCounts: [1, 0, 2], intensityMean: 2.3, durationTotalMinutes: 45, durationMeanMinutes: 22.5,
    };
    expect(statsDetails(stats)).toEqual(['3 registros', 'Intensidad media 2,3 (leve 1 · moderada 0 · grave 2)', 'Duración total 45 min (media 22,5 min)']);
    expect(statsDetails({ ...stats, logCount: 1, intensityCounts: null, intensityMean: null, durationTotalMinutes: null, durationMeanMinutes: null })).toEqual(['1 registro']);
  });

  it('draws a month with marks and counts, and only the period as active', () => {
    const symptom = item(10, 'symptom');
    const trigger = item(11, 'trigger');
    const logs = [3, 4, 5].flatMap((day, index): HealthEventLog[] => {
      const date = `2026-10-0${day}`;
      return [
        { id: `t${index}`, calendarId: CAL, itemDefinitionId: trigger.id, loggedAt: `${date}T08:00:00.000Z`, intensity: null, durationMinutes: null, notes: null, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` },
        { id: `s${index}`, calendarId: CAL, itemDefinitionId: symptom.id, loggedAt: `${date}T09:00:00.000Z`, intensity: 2, durationMinutes: null, notes: null, createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z` },
      ];
    });
    const snapshot = buildReportSnapshot({
      profile, items: [symptom, trigger], logs, from: '2026-10-02', to: '2026-10-20', timeZone: 'UTC',
      symptomRootIds: [symptom.id], triggerRootIds: [trigger.id], generatedAt: '2026-10-21T00:00:00.000Z',
    });
    const days = miniMonth(snapshot, '2026-10').filter((slot) => slot !== null);
    expect(days).toHaveLength(31);
    expect(days.find((day) => day.date === '2026-10-04')).toEqual({ date: '2026-10-04', day: 4, mark: 'watch', symptoms: 1, triggers: 1, inPeriod: true });
    expect(days.find((day) => day.date === '2026-10-01')?.inPeriod).toBe(false);
    expect(days.find((day) => day.date === '2026-10-25')).toMatchObject({ mark: null, symptoms: 0, triggers: 0, inPeriod: false });
  });

  it('builds a safe file name from the calendar name', () => {
    expect(reportFileName('Niño · Luna <b>', '2026-10-21T10:00:00.000Z')).toBe('cuidat-informe-nino-luna-b-2026-10-21.pdf');
    expect(reportFileName('🐱', '2026-10-21T10:00:00.000Z')).toBe('cuidat-informe-calendario-2026-10-21.pdf');
  });
});
