import { reportsResponseSchema, savedReportResponseSchema } from '@cuidat/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signUp } from '../../../test/support/apiSession.js';
import type { ApiSession, TestApp } from '../../../test/support/apiSession.js';
import { buildTestApp, startTestDatabase } from '../../../test/support/testDatabase.js';
import type { TestDatabase } from '../../../test/support/testDatabase.js';

// Saved reports (TECH_SPEC.md section 9.1). Dates are UTC days relative to now, so the data is never future.
const DAY = 86_400_000;
const HOUR = 3_600_000;

function utcDay(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);
}

interface Calendar {
  id: string;
  symptom: string;
  trigger: string;
}

/** A calendar with Pescado -> Vómito one hour apart on 3 earlier days: "Vigilar posible patrón". */
async function calendarWithPattern(session: ApiSession, name = 'Moby'): Promise<Calendar> {
  const created = await session.call('post', '/profiles', { name, profileType: 'Mascota', correlationWindowHours: 2 });
  const id = created.body.profile.id as string;
  const item = async (body: object): Promise<string> => (await session.call('post', `/profiles/${id}/items`, body)).body.item.id as string;
  const symptom = await item({ name: 'Vómito', emoji: '🤢', category: 'symptom', trackIntensity: true, trackDuration: false });
  const trigger = await item({ name: 'Pescado', emoji: '🐟', category: 'trigger', trackIntensity: false, trackDuration: false });
  for (const daysAgo of [3, 4, 5]) {
    const at = (offset: number): string => new Date(Date.parse(`${utcDay(daysAgo)}T10:00:00.000Z`) + offset).toISOString();
    for (const [itemId, offset, notes] of [[trigger, 0, null], [symptom, HOUR, 'Tras comer']] as const) {
      const logId = crypto.randomUUID();
      const response = await session.call('put', `/profiles/${id}/events/${logId}`, {
        itemDefinitionId: itemId, loggedAt: at(offset), intensity: itemId === symptom ? 2 : null, durationMinutes: null, notes,
        createdAt: at(offset), updatedAt: at(offset),
      });
      expect(response.status).toBe(200);
    }
  }
  return { id, symptom, trigger };
}

function reportBody(calendar: Calendar, overrides: object = {}): object {
  return {
    calendarId: calendar.id, from: utcDay(10), to: utcDay(0), timeZone: 'UTC',
    symptomRootIds: [calendar.symptom], triggerRootIds: [calendar.trigger], ...overrides,
  };
}

describe('reports API', () => {
  let db: TestDatabase;
  let app: TestApp;

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    await db.reset();
    app = buildTestApp(db);
  });

  it('requires a session', async () => {
    expect((await request(app).get('/api/reports')).status).toBe(401);
  });

  it('builds the snapshot on the server, lists it without the snapshot and returns it whole', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await calendarWithPattern(ana);

    const created = await ana.call('post', '/reports', reportBody(calendar, { title: '  Visita al veterinario ' }));
    expect(created.status).toBe(201);
    expect(created.body.report).toMatchObject({ calendarName: 'Moby', title: 'Visita al veterinario', periodFrom: utcDay(10), periodTo: utcDay(0) });
    expect(created.body.report).not.toHaveProperty('snapshot');

    const listed = reportsResponseSchema.parse((await ana.call('get', '/reports')).body);
    expect(listed.reports.map((report) => report.id)).toEqual([created.body.report.id]);

    const full = savedReportResponseSchema.parse((await ana.call('get', `/reports/${created.body.report.id}`)).body).report;
    expect(full.snapshot.calendar).toMatchObject({ name: 'Moby', correlationWindowHours: 2 });
    expect(full.snapshot.patterns).toEqual([{ triggerRootId: calendar.trigger, symptomRootId: calendar.symptom, occurrences: 3, category: 'Vigilar posible patrón' }]);
    expect(full.snapshot.days.filter((day) => day.mark === 'watch').map((day) => day.date)).toEqual([utcDay(5), utcDay(4), utcDay(3)]);
    expect(full.snapshot.days[0]?.logs.map((entry) => entry.notes)).toEqual([null, 'Tras comer']);
  });

  it('names a report after its calendar by default', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const created = await ana.call('post', '/reports', reportBody(await calendarWithPattern(ana)));
    expect(created.body.report.title).toBe('Informe de Moby');
  });

  it('keeps at most 5 reports per user, also under concurrent requests', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await calendarWithPattern(ana);
    const responses = await Promise.all(Array.from({ length: 6 }, () => ana.call('post', '/reports', reportBody(calendar))));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(5);
    const refused = responses.find((response) => response.status === 409);
    expect(refused?.body.error.code).toBe('REPORT_LIMIT');

    const reports = reportsResponseSchema.parse((await ana.call('get', '/reports')).body).reports;
    expect((await ana.call('delete', `/reports/${reports[0]!.id}`)).status).toBe(204);
    expect((await ana.call('post', '/reports', reportBody(calendar))).status).toBe(201);
  });

  it('never shows or deletes another user\'s report, nor reports on another user\'s calendar', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const eva = await signUp(app, 'eva@example.test');
    const calendar = await calendarWithPattern(ana);
    const reportId = (await ana.call('post', '/reports', reportBody(calendar))).body.report.id as string;

    expect((await eva.call('get', `/reports/${reportId}`)).status).toBe(404);
    expect((await eva.call('delete', `/reports/${reportId}`)).status).toBe(404);
    expect(reportsResponseSchema.parse((await eva.call('get', '/reports')).body).reports).toEqual([]);
    expect((await eva.call('post', '/reports', reportBody(calendar))).status).toBe(404);
    expect((await ana.call('get', `/reports/${reportId}`)).status).toBe(200);
  });

  it('refuses future or too long periods and a selection from another calendar', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await calendarWithPattern(ana);
    const other = await calendarWithPattern(ana, 'Luna');

    const future = await ana.call('post', '/reports', reportBody(calendar, { to: new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10) }));
    expect(future.body.error.code).toBe('REPORT_FUTURE_PERIOD');
    expect((await ana.call('post', '/reports', reportBody(calendar, { from: utcDay(400) }))).status).toBe(400);
    const foreign = await ana.call('post', '/reports', reportBody(calendar, { symptomRootIds: [other.symptom] }));
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe('INVALID_INPUT');
    expect((await ana.call('get', '/reports/no-es-un-uuid')).status).toBe(400);
  });

  it('erases the reports with their calendar and with the account (GDPR Art. 17)', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const kept = await calendarWithPattern(ana);
    const dropped = await calendarWithPattern(ana, 'Luna');
    await ana.call('post', '/reports', reportBody(kept));
    await ana.call('post', '/reports', reportBody(dropped));

    expect((await ana.call('delete', `/profiles/${dropped.id}`)).status).toBe(204);
    const left = reportsResponseSchema.parse((await ana.call('get', '/reports')).body).reports;
    expect(left.map((report) => report.calendarName)).toEqual(['Moby']);

    expect((await ana.call('delete', '/auth/account')).status).toBe(204);
    const stored = await db.pool.query<{ total: number }>('SELECT count(*)::int AS total FROM health_reports');
    expect(stored.rows[0]?.total).toBe(0);
  });
});
