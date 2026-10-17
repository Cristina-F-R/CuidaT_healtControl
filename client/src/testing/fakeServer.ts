import { createPresetItems } from '@cuidat/shared';
import type { AuthUser, CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import { fakeApi, jsonResponse, noContent } from './fakeApi';
import type { FakeRequest } from './fakeApi';

export const TEST_USER: AuthUser = { id: '7d4f3c1e-2b6a-4f7e-9a1c-3e5b8d2f6a90', email: 'ana@example.com' };

export interface FakeServer {
  fetch: ReturnType<typeof fakeApi>;
  profile: CalendarProfile;
  items: HealthItemDefinition[];
  logs: Map<string, HealthEventLog>;
  /** Whether a session cookie exists (GET /me answers the user). */
  signedIn: boolean;
  /** When set, PUT and DELETE of events answer this status (to simulate outages or refusals). */
  eventWriteStatus: number | null;
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
  const items = createPresetItems(profile.id, () => `22222222-2222-4222-8222-${String(++next).padStart(12, '0')}`, new Date('2026-01-01T00:00:00.000Z'));
  const server: FakeServer = { fetch: fakeApi({}), profile, items, logs: new Map(), signedIn, eventWriteStatus: null };

  server.fetch = fakeApi({
    'GET /api/auth/me': () =>
      server.signedIn ? jsonResponse(200, { user: TEST_USER }) : jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } }),
    'POST /api/auth/login': () => {
      server.signedIn = true;
      return jsonResponse(200, { user: TEST_USER });
    },
    'POST /api/auth/logout': () => {
      server.signedIn = false;
      return noContent();
    },
    'GET /api/profiles': () => jsonResponse(200, { profiles: [server.profile] }),
    'GET /api/profiles/:id/items': () => jsonResponse(200, { items: server.items }),
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
  });
  return server;
}
