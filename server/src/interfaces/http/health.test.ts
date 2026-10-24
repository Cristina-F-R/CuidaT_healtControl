import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, startTestDatabase } from '../../../test/support/testDatabase.js';
import type { TestDatabase } from '../../../test/support/testDatabase.js';

describe('health check', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('answers 200 without a session and is not cached', async () => {
    const response = await request(buildTestApp(db)).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('does not count towards the API rate limit (100 requests per minute)', async () => {
    const app = buildTestApp(db);
    for (let attempt = 0; attempt < 105; attempt += 1) {
      expect((await request(app).get('/api/health')).status).toBe(200);
    }
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });
});
