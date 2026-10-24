import { buildReportSnapshot, createPresetItems, REPORTS_MAX_PER_USER, reportCreateSchema } from '@cuidat/shared';
import type { AuthUser, CalendarProfile, HealthEventLog, HealthItemDefinition, SavedReport } from '@cuidat/shared';
import { fakeApi, jsonResponse, noContent } from './fakeApi';
import type { FakeRequest } from './fakeApi';

export const TEST_USER: AuthUser = { id: '7d4f3c1e-2b6a-4f7e-9a1c-3e5b8d2f6a90', email: 'ana@example.com' };

export interface FakeServer {
  fetch: ReturnType<typeof fakeApi>;
  /** The account's first calendar (also `profiles[0]` until it is deleted). */
  profile: CalendarProfile;
  /** Every calendar of the account; empty to test the first-calendar onboarding. */
  profiles: CalendarProfile[];
  items: HealthItemDefinition[];
  logs: Map<string, HealthEventLog>;
  /** Bodies received by `POST /api/auth/register`. */
  registerBodies: unknown[];
  /** Whether a session cookie exists (GET /me answers the user). */
  signedIn: boolean;
  /** When set, PUT and DELETE of events answer this status (to simulate outages or refusals). */
  eventWriteStatus: number | null;
  /** Saved reports, built with the real snapshot builder (TECH_SPEC.md section 9.1). */
  reports: SavedReport[];
}

function idFrom(request: FakeRequest): string {
  return request.path.split('/').pop() ?? '';
}

/** A small in-memory API with one account, one calendar and the sample catalog. */
export function createFakeServer(signedIn = false): FakeServer {
  const profile: CalendarProfile = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Luna',
    profileType: 'Mascota',
    avatarIcon: '🐱',
    colorTheme: 'slate',
    correlationWindowHours: 48,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
  let next = 0;
  const newId = (): string => `22222222-2222-4222-8222-${String(++next).padStart(12, '0')}`;
  const items = createPresetItems(profile.id, newId, new Date('2026-01-01T00:00:00.000Z'));
  const server: FakeServer = { fetch: fakeApi({}), profile, profiles: [profile], items, logs: new Map(), signedIn, registerBodies: [], eventWriteStatus: null, reports: [] };
  const summary = ({ id, calendarId, calendarName, title, periodFrom, periodTo, createdAt }: SavedReport): Omit<SavedReport, 'snapshot'> => ({
    id, calendarId, calendarName, title, periodFrom, periodTo, createdAt,
  });

  server.fetch = fakeApi({
    'GET /api/auth/me': () =>
      server.signedIn ? jsonResponse(200, { user: TEST_USER }) : jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } }),
    'POST /api/auth/login': () => {
      server.signedIn = true;
      return jsonResponse(200, { user: TEST_USER });
    },
    'POST /api/auth/register': (request) => {
      server.registerBodies.push(request.body);
      server.signedIn = true;
      return jsonResponse(201, { user: TEST_USER });
    },
    'POST /api/auth/logout': () => {
      server.signedIn = false;
      return noContent();
    },
    'GET /api/profiles': () => jsonResponse(200, { profiles: server.profiles }),
    'POST /api/profiles': (request) => {
      const body = request.body as Pick<CalendarProfile, 'name' | 'profileType'> & Partial<CalendarProfile>;
      const created: CalendarProfile = {
        avatarIcon: '👤',
        colorTheme: 'slate',
        correlationWindowHours: 48,
        ...body,
        id: `33333333-3333-4333-8333-${String(++next).padStart(12, '0')}`,
        createdAt: '2026-02-01T00:00:00.000Z',
      };
      server.profiles.push(created);
      return jsonResponse(201, { profile: created });
    },
    'PATCH /api/profiles/:id': (request) => {
      const current = server.profiles.find((candidate) => candidate.id === idFrom(request));
      if (!current) {
        return jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'El calendario no existe.' } });
      }
      Object.assign(current, request.body);
      return jsonResponse(200, { profile: current });
    },
    'DELETE /api/profiles/:id': (request) => {
      if (server.profiles.length <= 1) {
        return jsonResponse(422, { error: { code: 'PROFILE_LAST', message: 'No se puede eliminar el último calendario.' } });
      }
      server.profiles = server.profiles.filter((candidate) => candidate.id !== idFrom(request));
      return noContent();
    },
    'POST /api/profiles/:id/items/presets': (request) => {
      const presets = createPresetItems(request.path.split('/')[3] ?? '', newId, new Date('2026-01-01T00:00:00.000Z'));
      server.items.push(...presets);
      return jsonResponse(201, { items: presets });
    },
    'GET /api/profiles/:id/items': (request) =>
      jsonResponse(200, { items: server.items.filter((item) => item.calendarId === request.path.split('/')[3]) }),
    'GET /api/profiles/:id/events': (request) => {
      const from = Date.parse(request.query.get('from') ?? '1970-01-01T00:00:00.000Z');
      const to = Date.parse(request.query.get('to') ?? '2999-01-01T00:00:00.000Z');
      const logs = [...server.logs.values()].filter((log) => Date.parse(log.loggedAt) >= from && Date.parse(log.loggedAt) <= to);
      return jsonResponse(200, { logs });
    },
    'PUT /api/profiles/:id/events/:logId': (request) => {
      if (server.eventWriteStatus !== null) {
        return jsonResponse(server.eventWriteStatus, { error: { code: 'TEST_REFUSED', message: 'Rechazado en la prueba.' } });
      }
      const body = request.body as Omit<HealthEventLog, 'id' | 'calendarId'>;
      const log: HealthEventLog = { ...body, id: idFrom(request), calendarId: server.profile.id };
      server.logs.set(log.id, log);
      return jsonResponse(200, { log });
    },
    'DELETE /api/profiles/:id/events/:logId': (request) => {
      if (server.eventWriteStatus !== null) {
        return jsonResponse(server.eventWriteStatus, { error: { code: 'TEST_REFUSED', message: 'Rechazado en la prueba.' } });
      }
      server.logs.delete(idFrom(request));
      return noContent();
    },
    'GET /api/reports': () => jsonResponse(200, { reports: server.reports.map(summary) }),
    'POST /api/reports': (request) => {
      const body = reportCreateSchema.parse(request.body);
      if (server.reports.length >= REPORTS_MAX_PER_USER) {
        return jsonResponse(409, { error: { code: 'REPORT_LIMIT', message: 'Has alcanzado el máximo de 5 informes. Elimina uno para guardar otro.' } });
      }
      const calendar = server.profiles.find((candidate) => candidate.id === body.calendarId) ?? server.profile;
      const createdAt = new Date().toISOString();
      const snapshot = buildReportSnapshot({
        ...body, profile: calendar, items: server.items, logs: [...server.logs.values()], generatedAt: createdAt,
      });
      const report: SavedReport = {
        id: newId(), calendarId: calendar.id, calendarName: calendar.name, title: body.title ?? `Informe de ${calendar.name}`,
        periodFrom: body.from, periodTo: body.to, createdAt, snapshot,
      };
      server.reports = [report, ...server.reports];
      return jsonResponse(201, { report: summary(report) });
    },
    'GET /api/reports/:id': (request) => {
      const report = server.reports.find((candidate) => candidate.id === idFrom(request));
      return report ? jsonResponse(200, { report }) : jsonResponse(404, { error: { code: 'NOT_FOUND', message: 'El informe no existe.' } });
    },
    'DELETE /api/reports/:id': (request) => {
      server.reports = server.reports.filter((candidate) => candidate.id !== idFrom(request));
      return noContent();
    },
  });
  return server;
}
