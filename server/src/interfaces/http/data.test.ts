import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, startTestDatabase, TEST_ORIGIN } from '../../../test/support/testDatabase.js';
import type { TestDatabase } from '../../../test/support/testDatabase.js';

type App = ReturnType<typeof buildTestApp>;
type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

const PASSWORD = 'contraseña-segura-2026';
const HOUR = 3_600_000;

interface Session {
  call: (method: Method, path: string, body?: object) => Promise<request.Response>;
}

async function signUp(app: App, email: string): Promise<Session> {
  const registered = await request(app)
    .post('/api/auth/register')
    .set('X-CuidaT-Client', 'web')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: PASSWORD });
  const cookie = registered.headers['set-cookie']?.find((value: string) => value.startsWith('cuidat_session=')) ?? '';
  expect(cookie).not.toBe('');
  return {
    call: (method, path, body) => {
      const pending = request(app)[method](`/api${path}`).set('Cookie', cookie).set('X-CuidaT-Client', 'web').set('Origin', TEST_ORIGIN);
      return body ? pending.send(body) : pending;
    },
  };
}

async function createCalendar(session: Session, name = 'Moby'): Promise<string> {
  const response = await session.call('post', '/profiles', { name, profileType: 'Mascota' });
  expect(response.status).toBe(201);
  return response.body.profile.id as string;
}

async function createItem(session: Session, profileId: string, overrides: object = {}): Promise<{ id: string; rootId: string }> {
  const response = await session.call('post', `/profiles/${profileId}/items`, {
    name: 'Vómito', emoji: '🤢', category: 'symptom', trackIntensity: true, trackDuration: false, ...overrides,
  });
  expect(response.status).toBe(201);
  return response.body.item as { id: string; rootId: string };
}

function eventBody(itemDefinitionId: string, overrides: object = {}): object {
  const now = new Date(Date.now() - HOUR).toISOString();
  return { itemDefinitionId, loggedAt: now, intensity: 2, durationMinutes: null, notes: 'Tras comer', createdAt: now, updatedAt: now, ...overrides };
}

describe('data API (profiles, catalog, events)', () => {
  let db: TestDatabase;
  let app: App;

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

  it('requires a session and the CSRF header', async () => {
    expect((await request(app).get('/api/profiles')).status).toBe(401);
    const ana = await signUp(app, 'ana@example.test');
    const withoutHeader = await request(app).post('/api/profiles').set('Origin', TEST_ORIGIN).send({ name: 'X', profileType: 'Adulto' });
    expect(withoutHeader.status).toBe(403);
    expect((await ana.call('get', '/profiles/no-es-un-uuid/items')).status).toBe(400);
  });

  it('creates, lists, edits and protects the last profile', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const first = await createCalendar(ana);
    const patched = await ana.call('patch', `/profiles/${first}`, { name: '  Moby II ', correlationWindowHours: 24 });
    expect(patched.status).toBe(200);
    expect(patched.body.profile).toMatchObject({ name: 'Moby II', correlationWindowHours: 24, profileType: 'Mascota' });
    expect((await ana.call('patch', `/profiles/${first}`, { correlationWindowHours: 5 })).status).toBe(400);
    expect((await ana.call('patch', `/profiles/${first}`, {})).status).toBe(400);

    const last = await ana.call('delete', `/profiles/${first}`);
    expect(last.status).toBe(400);
    expect(last.body.error.code).toBe('PROFILE_LAST');

    const second = await createCalendar(ana, 'Luna');
    expect((await ana.call('get', '/profiles')).body.profiles).toHaveLength(2);
    expect((await ana.call('delete', `/profiles/${second}`)).status).toBe(204);
    expect((await ana.call('get', '/profiles')).body.profiles.map((profile: { id: string }) => profile.id)).toEqual([first]);
  });

  it('never deletes the last profile under two concurrent deletions', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const first = await createCalendar(ana);
    const second = await createCalendar(ana, 'Luna');
    const results = await Promise.all([ana.call('delete', `/profiles/${first}`), ana.call('delete', `/profiles/${second}`)]);
    expect(results.map((response) => response.status).sort()).toEqual([204, 400]);
    expect((await ana.call('get', '/profiles')).body.profiles).toHaveLength(1);
  });

  it('isolates users: another user\'s calendar, items and logs answer 404 or 409', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const eva = await signUp(app, 'eva@example.test');
    const anaCalendar = await createCalendar(ana);
    const evaCalendar = await createCalendar(eva, 'Luna');
    const anaItem = await createItem(ana, anaCalendar);
    const evaItem = await createItem(eva, evaCalendar);
    const logId = crypto.randomUUID();
    expect((await ana.call('put', `/profiles/${anaCalendar}/events/${logId}`, eventBody(anaItem.id))).status).toBe(200);

    expect((await eva.call('get', `/profiles/${anaCalendar}/items`)).status).toBe(404);
    expect((await eva.call('get', `/profiles/${anaCalendar}/events`)).status).toBe(404);
    expect((await eva.call('patch', `/profiles/${anaCalendar}`, { name: 'Robado' })).status).toBe(404);
    expect((await eva.call('delete', `/profiles/${anaCalendar}`)).status).toBe(404);
    expect((await eva.call('post', `/profiles/${anaCalendar}/items`, { name: 'X', emoji: '❌', category: 'symptom', trackIntensity: false, trackDuration: false })).status).toBe(404);
    expect((await eva.call('post', `/profiles/${anaCalendar}/items/${anaItem.rootId}/archive`)).status).toBe(404);
    // Eva's own calendar cannot point at Ana's item, nor reuse the id of Ana's log.
    expect((await eva.call('put', `/profiles/${evaCalendar}/events/${crypto.randomUUID()}`, eventBody(anaItem.id))).status).toBe(404);
    const stolenId = await eva.call('put', `/profiles/${evaCalendar}/events/${logId}`, eventBody(evaItem.id, { updatedAt: new Date().toISOString() }));
    expect(stolenId.status).toBe(409);
    expect(stolenId.body.error.code).toBe('EVENT_ID_CONFLICT');
    // Deletes in another calendar are silent no-ops.
    expect((await eva.call('delete', `/profiles/${evaCalendar}/events/${logId}`)).status).toBe(204);
    expect((await eva.call('delete', `/profiles/${anaCalendar}/items/${anaItem.rootId}`)).status).toBe(204);

    const anaLogs = await ana.call('get', `/profiles/${anaCalendar}/events`);
    expect(anaLogs.body.logs).toHaveLength(1);
    expect(anaLogs.body.logs[0].notes).toBe('Tras comer');
    expect((await ana.call('get', `/profiles/${anaCalendar}/items`)).body.items).toHaveLength(1);
  });

  it('rejects logs beyond now() + 5 minutes and accepts the tolerance', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const item = await createItem(ana, calendar);
    const inTolerance = new Date(Date.now() + 3 * 60_000).toISOString();
    const future = new Date(Date.now() + 10 * 60_000).toISOString();

    expect((await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(item.id, { loggedAt: inTolerance }))).status).toBe(200);
    const rejected = await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(item.id, { loggedAt: future }));
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('FUTURE_DATE');
  });

  it('upserts idempotently with last write wins and a clamped updated_at', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const item = await createItem(ana, calendar);
    const id = crypto.randomUUID();
    const path = `/profiles/${calendar}/events/${id}`;
    const body = eventBody(item.id);

    expect((await ana.call('put', path, body)).status).toBe(200);
    expect((await ana.call('put', path, body)).status).toBe(200);
    const newer = new Date().toISOString();
    expect((await ana.call('put', path, { ...body, intensity: 3, updatedAt: newer })).body.log.intensity).toBe(3);
    // An older write is ignored and the stored row is returned.
    const stale = await ana.call('put', path, { ...body, intensity: 1 });
    expect(stale.body.log.intensity).toBe(3);
    // A clock far in the future cannot win every later conflict: it is clamped.
    const farFuture = await ana.call('put', path, { ...body, notes: 'reloj adelantado', updatedAt: '2099-01-01T00:00:00.000Z' });
    expect(Date.parse(farFuture.body.log.updatedAt)).toBeLessThanOrEqual(Date.now() + 5 * 60_000);
    // Empty notes are stored as NULL.
    const cleared = await ana.call('put', path, { ...body, notes: '   ', updatedAt: farFuture.body.log.updatedAt.replace(/\.\d+Z$/, '.999Z') });
    expect(cleared.body.log.notes).toBeNull();

    expect((await db.pool.query('SELECT id FROM health_event_logs')).rows).toHaveLength(1);
    expect((await ana.call('delete', path)).status).toBe(204);
    expect((await ana.call('delete', path)).status).toBe(204);
    expect((await ana.call('get', `/profiles/${calendar}/events`)).body.logs).toEqual([]);
  });

  it('returns the last three months by default and honours from/to', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const item = await createItem(ana, calendar);
    const old = new Date(Date.now() - 120 * 24 * HOUR).toISOString();
    const recent = new Date(Date.now() - 2 * HOUR).toISOString();
    for (const loggedAt of [old, recent]) {
      await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(item.id, { loggedAt, createdAt: loggedAt }));
    }
    expect((await ana.call('get', `/profiles/${calendar}/events`)).body.logs).toHaveLength(1);
    const from = new Date(Date.now() - 200 * 24 * HOUR).toISOString();
    expect((await ana.call('get', `/profiles/${calendar}/events?from=${from}`)).body.logs).toHaveLength(2);
    expect((await ana.call('get', `/profiles/${calendar}/events?from=${recent}&to=${old}`)).status).toBe(400);
  });

  it('checks metrics against the item version', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const fish = await createItem(ana, calendar, { name: 'Pescado', emoji: '🐟', category: 'trigger', trackIntensity: false });
    const response = await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(fish.id));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_INPUT');
    expect((await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(fish.id, { intensity: null }))).status).toBe(200);
  });

  it('runs the catalog lifecycle: versioning, archive, restore, impact and cascade delete', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const item = await createItem(ana, calendar);
    const base = `/profiles/${calendar}/items/${item.rootId}`;
    await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(item.id));

    // Name: retroactive, in place. Tracking flags: a new version.
    const edited = await ana.call('patch', base, { name: 'Vómitos', trackDuration: true });
    expect(edited.status).toBe(200);
    const lineage = edited.body.items as { id: string; name: string; status: string; parentId: string | null; trackDuration: boolean }[];
    expect(lineage).toHaveLength(2);
    expect(lineage.every((version) => version.name === 'Vómitos')).toBe(true);
    expect(lineage.find((version) => version.id === item.id)?.status).toBe('superseded');
    const live = lineage.find((version) => version.status === 'active')!;
    expect(live).toMatchObject({ parentId: item.id, trackDuration: true });

    const locked = await ana.call('patch', base, { category: 'trigger' });
    expect(locked.status).toBe(400);
    expect(locked.body.error.code).toBe('CATEGORY_LOCKED');
    expect((await ana.call('get', `/profiles/${calendar}/items?status=superseded`)).body.items).toHaveLength(1);

    // Archived items refuse new online logs; a deferred (synced) log is still accepted.
    expect((await ana.call('post', `${base}/archive`)).body.items.find((version: { id: string }) => version.id === live.id).status).toBe('archived');
    const online = await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(live.id));
    expect(online.status).toBe(400);
    expect(online.body.error.code).toBe('ITEM_NOT_ACTIVE');
    expect((await ana.call('put', `/profiles/${calendar}/events/${crypto.randomUUID()}`, eventBody(live.id, { deferred: true }))).status).toBe(200);
    expect((await ana.call('post', `${base}/archive`)).body.error.code).toBe('ITEM_NOT_ACTIVE');
    expect((await ana.call('post', `${base}/restore`)).status).toBe(200);

    expect((await ana.call('get', `${base}/impact`)).body.logs).toBe(2);
    expect((await ana.call('delete', base)).status).toBe(204);
    expect((await ana.call('get', `/profiles/${calendar}/items`)).body.items).toEqual([]);
    expect((await db.pool.query('SELECT id FROM health_event_logs')).rows).toHaveLength(0);
    expect((await ana.call('get', `${base}/impact`)).status).toBe(404);
  });

  it('adds the six sample items in one call', async () => {
    const ana = await signUp(app, 'ana@example.test');
    const calendar = await createCalendar(ana);
    const response = await ana.call('post', `/profiles/${calendar}/items/presets`);
    expect(response.status).toBe(201);
    expect(response.body.items).toHaveLength(6);
    expect((await ana.call('get', `/profiles/${calendar}/items?status=active`)).body.items).toHaveLength(6);
  });
});
