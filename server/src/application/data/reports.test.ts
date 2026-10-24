import type { CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../domain/errors.js';
import type { EventRepository, ItemRepository, ProfileRepository, ReportRepository } from '../../domain/ports.js';
import type { DataDependencies } from './dataDependencies.js';
import { createReport } from './reports.js';

// The size cap of a snapshot (TECH_SPEC.md section 9.1) would need thousands of real logs, so it is
// checked here with in-memory ports.
const CAL = '00000000-0000-4000-8000-000000000001';
const ITEM = '00000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-10-20T12:00:00.000Z');

const profile: CalendarProfile = {
  id: CAL, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'slate', correlationWindowHours: 2, createdAt: '2026-01-01T00:00:00.000Z',
};
const symptom: HealthItemDefinition = {
  id: ITEM, calendarId: CAL, rootId: ITEM, parentId: null, name: 'Vómito', emoji: '🤢', category: 'symptom',
  trackIntensity: true, trackDuration: false, status: 'active', createdAt: '2026-01-01T00:00:00.000Z',
};

function depsWith(logs: HealthEventLog[], reports: Partial<ReportRepository> = {}): DataDependencies {
  return {
    profiles: { find: vi.fn().mockResolvedValue(profile) } as unknown as ProfileRepository,
    items: { list: vi.fn().mockResolvedValue([symptom]) } as unknown as ItemRepository,
    events: { list: vi.fn().mockResolvedValue(logs) } as unknown as EventRepository,
    reports: { insertWithinLimit: vi.fn().mockResolvedValue('created'), ...reports } as unknown as ReportRepository,
    clock: () => NOW,
    newId: () => '00000000-0000-4000-8000-000000000099',
  };
}

const body = {
  calendarId: CAL, from: '2026-01-01', to: '2026-10-20', timeZone: 'UTC', symptomRootIds: [ITEM], triggerRootIds: [],
};

describe('createReport', () => {
  it('refuses a snapshot over the size cap without storing it', async () => {
    const notes = 'x'.repeat(300);
    const logs = Array.from({ length: 4000 }, (_, index): HealthEventLog => {
      const at = new Date(Date.parse('2026-01-02T00:00:00.000Z') + index * 3_600_000).toISOString();
      return { id: `log-${index}`, calendarId: CAL, itemDefinitionId: ITEM, loggedAt: at, intensity: 2, durationMinutes: null, notes, createdAt: at, updatedAt: at };
    });
    const deps = depsWith(logs);
    const failure = await createReport(deps, 'user', body).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AppError);
    expect(failure).toMatchObject({ status: 413, code: 'REPORT_TOO_LARGE' });
    expect(deps.reports.insertWithinLimit).not.toHaveBeenCalled();
  });

  it('answers 404 when the calendar disappears between the read and the insert', async () => {
    const deps = depsWith([], { insertWithinLimit: vi.fn().mockResolvedValue('calendar_not_found') });
    await expect(createReport(deps, 'user', body)).rejects.toMatchObject({ status: 404 });
  });
});
