import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createPresetItems, type GuestData } from '@cuidat/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, startTestDatabase, TEST_ORIGIN } from '../../../test/support/testDatabase.js';
import type { TestDatabase } from '../../../test/support/testDatabase.js';

const PASSWORD = 'contraseña-segura-2026';
const CALENDAR = '00000000-0000-4000-8000-0000000000c1';

type App = ReturnType<typeof buildTestApp>;

/** Every state-changing request must carry the CSRF header and the client origin (TECH_SPEC section 7). */
function post(app: App, path: string): request.Test {
  return request(app).post(path).set('X-CuidaT-Client', 'web').set('Origin', TEST_ORIGIN);
}

function cookieOf(response: request.Response): string | undefined {
  return response.headers['set-cookie']?.find((value: string) => value.startsWith('cuidat_session='));
}

function guestFixture(): GuestData {
  const items = createPresetItems(CALENDAR, () => crypto.randomUUID(), new Date('2026-04-10T10:00:00.000Z')).map((item) => ({
    ...item,
    calendarId: CALENDAR,
    createdAt: '2026-04-10T10:00:00.000Z',
  }));
  const vomit = items.find((item) => item.name === 'Vómito')!;
  return {
    version: 1,
    profiles: [{ id: CALENDAR, name: 'Moby', profileType: 'Mascota', avatarIcon: '🐶', colorTheme: 'slate', correlationWindowHours: 48, createdAt: '2026-04-10T10:00:00.000Z' }],
    items,
    logs: [
      { id: crypto.randomUUID(), calendarId: CALENDAR, itemDefinitionId: vomit.id, loggedAt: '2026-04-20T09:00:00.000Z', intensity: 2, durationMinutes: null, notes: 'Tras comer', createdAt: '2026-04-20T09:00:00.000Z', updatedAt: '2026-04-20T09:00:00.000Z' },
    ],
  };
}

describe('authentication API', () => {
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

  it('registers, stores a bcrypt hash and sets an httpOnly SameSite=Lax session cookie', async () => {
    const response = await post(app, '/api/auth/register').send({ email: 'Ana@Example.test', password: PASSWORD });
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('ana@example.test');
    expect(cookieOf(response)).toMatch(/HttpOnly/);
    expect(cookieOf(response)).toMatch(/SameSite=Lax/);

    const stored = await db.pool.query<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(stored.rows[0]?.password_hash).toMatch(/^\$2b\$12\$/);
    expect(stored.rows[0]?.password_hash).not.toContain(PASSWORD);
  });

  it('refuses requests without the CSRF header or from another origin', async () => {
    const body = { email: 'csrf@example.test', password: PASSWORD };
    expect((await request(app).post('/api/auth/register').send(body)).status).toBe(403);
    const foreign = await request(app).post('/api/auth/register').set('X-CuidaT-Client', 'web').set('Origin', 'https://evil.example').send(body);
    expect(foreign.status).toBe(403);
  });

  it('validates input and names the fields without echoing the values', async () => {
    const response = await post(app, '/api/auth/register').send({ email: 'no-es-email', password: 'corta' });
    expect(response.status).toBe(400);
    expect(response.body.error.fields).toEqual(expect.arrayContaining(['email', 'password']));
    expect(JSON.stringify(response.body)).not.toContain('corta');
  });

  it('answers 409 when the email is already registered', async () => {
    await post(app, '/api/auth/register').send({ email: 'dup@example.test', password: PASSWORD });
    const again = await post(app, '/api/auth/register').send({ email: 'dup@example.test', password: PASSWORD });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('imports the guest calendar in the same transaction, with new ids', async () => {
    const guest = guestFixture();
    const response = await post(app, '/api/auth/register').send({ email: 'migra@example.test', password: PASSWORD, guestData: guest });
    expect(response.status).toBe(201);

    const profiles = await db.pool.query<{ id: string }>('SELECT id FROM calendar_profiles');
    expect(profiles.rows).toHaveLength(1);
    expect(profiles.rows[0]?.id).not.toBe(CALENDAR);
    const items = await db.pool.query('SELECT id FROM health_item_definitions');
    expect(items.rows).toHaveLength(6);
    const logs = await db.pool.query('SELECT notes FROM health_event_logs');
    expect(logs.rows).toEqual([{ notes: 'Tras comer' }]);
  });

  it('rolls back the account when the guest data breaks a rule', async () => {
    const guest = guestFixture();
    const log = guest.logs[0]!;
    guest.logs = [{ ...log, loggedAt: '2030-01-01T09:00:00.000Z' }];
    const response = await post(app, '/api/auth/register').send({ email: 'futuro@example.test', password: PASSWORD, guestData: guest });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FUTURE_DATE');
    const users = await db.pool.query('SELECT id FROM users');
    expect(users.rows).toHaveLength(0);
  });

  it('refuses a guest with more than 3 triggers or medication with 409 GUEST_LIMIT', async () => {
    const guest = guestFixture();
    const trigger = { ...guest.items[0]!, id: crypto.randomUUID(), rootId: '', parentId: null, category: 'trigger' as const };
    trigger.rootId = trigger.id;
    const extra = [1, 2, 3].map((n) => ({ ...trigger, id: crypto.randomUUID(), rootId: crypto.randomUUID(), name: `Extra ${n}` }));
    guest.items = [...guest.items, ...extra.map((item) => ({ ...item, rootId: item.id }))];
    const response = await post(app, '/api/auth/register').send({ email: 'limite@example.test', password: PASSWORD, guestData: guest });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('GUEST_LIMIT');
  });

  it('gives the same error for an unknown email and for a wrong password, and logs in with the right one', async () => {
    await post(app, '/api/auth/register').send({ email: 'login@example.test', password: PASSWORD });
    const unknown = await post(app, '/api/auth/login').send({ email: 'nadie@example.test', password: PASSWORD });
    const wrong = await post(app, '/api/auth/login').send({ email: 'login@example.test', password: 'otra-contraseña-2026' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);

    const ok = await post(app, '/api/auth/login').send({ email: 'login@example.test', password: PASSWORD });
    expect(ok.status).toBe(200);
    expect(cookieOf(ok)).toBeDefined();
  });

  it('limits register and login attempts per window (AUTH_RATE_LIMIT_MAX)', async () => {
    const limited = buildTestApp(db, { AUTH_RATE_LIMIT_MAX: '3' });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post(limited, '/api/auth/login').send({ email: 'x@example.test', password: PASSWORD })).status).toBe(401);
    }
    const blocked = await post(limited, '/api/auth/login').send({ email: 'x@example.test', password: PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('restores the session with /me and rejects missing or forged sessions', async () => {
    const registered = await post(app, '/api/auth/register').send({ email: 'me@example.test', password: PASSWORD });
    const session = cookieOf(registered)!;

    const me = await request(app).get('/api/auth/me').set('Cookie', session);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('me@example.test');

    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = jwt.sign({ sub: me.body.user.id }, 'otro-secreto-que-no-es-el-del-servidor-123', { algorithm: 'HS256' });
    expect((await request(app).get('/api/auth/me').set('Cookie', `cuidat_session=${forged}`)).status).toBe(401);
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ sub: me.body.user.id })).toString('base64url');
    expect((await request(app).get('/api/auth/me').set('Cookie', `cuidat_session=${header}.${body}.`)).status).toBe(401);
  });

  it('clears the session cookie on logout', async () => {
    const response = await post(app, '/api/auth/logout');
    expect(response.status).toBe(204);
    expect(cookieOf(response)).toMatch(/cuidat_session=;/);
  });

  it('deletes the account and its whole calendar in cascade, and clears the session (GDPR Art. 17)', async () => {
    const registered = await post(app, '/api/auth/register').send({ email: 'olvido@example.test', password: PASSWORD, guestData: guestFixture() });
    const other = await post(app, '/api/auth/register').send({ email: 'otra@example.test', password: PASSWORD, guestData: guestFixture() });
    expect(other.status).toBe(201);
    const session = cookieOf(registered)!;

    const response = await request(app).delete('/api/auth/account').set('X-CuidaT-Client', 'web').set('Origin', TEST_ORIGIN).set('Cookie', session);
    expect(response.status).toBe(204);
    expect(cookieOf(response)).toMatch(/cuidat_session=;/);

    const users = await db.pool.query<{ email: string }>('SELECT email FROM users');
    expect(users.rows).toEqual([{ email: 'otra@example.test' }]);
    // Only the other user's calendar is left: one profile, six items, one log.
    expect((await db.pool.query('SELECT id FROM calendar_profiles')).rows).toHaveLength(1);
    expect((await db.pool.query('SELECT id FROM health_item_definitions')).rows).toHaveLength(6);
    expect((await db.pool.query('SELECT id FROM health_event_logs')).rows).toHaveLength(1);

    // The old token no longer opens a session and the credentials no longer work.
    expect((await request(app).get('/api/auth/me').set('Cookie', session)).status).toBe(401);
    expect((await post(app, '/api/auth/login').send({ email: 'olvido@example.test', password: PASSWORD })).status).toBe(401);
  });

  it('refuses account deletion without a session or without the CSRF header', async () => {
    const registered = await post(app, '/api/auth/register').send({ email: 'csrf@example.test', password: PASSWORD });
    const session = cookieOf(registered)!;

    expect((await request(app).delete('/api/auth/account').set('X-CuidaT-Client', 'web').set('Origin', TEST_ORIGIN)).status).toBe(401);
    expect((await request(app).delete('/api/auth/account').set('Origin', TEST_ORIGIN).set('Cookie', session)).status).toBe(403);
    expect((await request(app).delete('/api/auth/account').set('X-CuidaT-Client', 'web').set('Origin', 'https://evil.example').set('Cookie', session)).status).toBe(403);
    expect((await db.pool.query('SELECT id FROM users')).rows).toHaveLength(1);
  });

  it('answers unknown API routes with JSON 404 and sends security headers', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['content-security-policy']).toMatch(/default-src 'self'/);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('asks for HTTPS upgrades only when the client origin is HTTPS', async () => {
    const plain = await request(buildTestApp(db)).get('/api/no-existe');
    expect(plain.headers['content-security-policy']).not.toMatch(/upgrade-insecure-requests/);
    const secure = await request(buildTestApp(db, { CLIENT_ORIGIN: 'https://cuidat.example' })).get('/api/no-existe');
    expect(secure.headers['content-security-policy']).toMatch(/upgrade-insecure-requests/);
  });

  it('rejects oversized bodies on ordinary routes with 413', async () => {
    const response = await post(app, '/api/auth/login').send({ email: 'a@example.test', password: 'x'.repeat(200_000) });
    expect(response.status).toBe(413);
  });
});
