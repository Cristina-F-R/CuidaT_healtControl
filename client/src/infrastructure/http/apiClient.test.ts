import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, NetworkError } from './apiClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the session cookie, the CSRF header and a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('POST', '/auth/login', { email: 'a@b.es' })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(init.credentials).toBe('include');
    expect(init.headers).toEqual({ 'X-CuidaT-Client': 'web', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"email":"a@b.es"}');
  });

  it('omits the content type without a body and returns null for 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('POST', '/auth/logout')).resolves.toBeNull();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ 'X-CuidaT-Client': 'web' });
  });

  it('turns the API error body into an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'No válido.', fields: ['email'] } }),
    ));

    const error: unknown = await apiRequest('POST', '/auth/register', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'No válido.', fields: ['email'] });
  });

  it('answers a generic ApiError when the error body is not the API shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })));

    await expect(apiRequest('GET', '/auth/me')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('throws NetworkError when the request never gets an answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('GET', '/auth/me')).rejects.toBeInstanceOf(NetworkError);
  });
});
