import request from 'supertest';
import { expect } from 'vitest';
import { TEST_ORIGIN } from './testDatabase.js';
import type { buildTestApp } from './testDatabase.js';

export type TestApp = ReturnType<typeof buildTestApp>;
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export const TEST_PASSWORD = 'contraseña-segura-2026';

/** A registered user: every call carries the session cookie and the CSRF header (TECH_SPEC.md section 7). */
export interface ApiSession {
  call: (method: Method, path: string, body?: object) => Promise<request.Response>;
}

export async function signUp(app: TestApp, email: string): Promise<ApiSession> {
  const registered = await request(app)
    .post('/api/auth/register')
    .set('X-CuidaT-Client', 'web')
    .set('Origin', TEST_ORIGIN)
    .send({ email, password: TEST_PASSWORD });
  const cookie = registered.headers['set-cookie']?.find((value: string) => value.startsWith('cuidat_session=')) ?? '';
  expect(cookie).not.toBe('');
  return {
    call: (method, path, body) => {
      const pending = request(app)[method](`/api${path}`).set('Cookie', cookie).set('X-CuidaT-Client', 'web').set('Origin', TEST_ORIGIN);
      return body ? pending.send(body) : pending;
    },
  };
}
