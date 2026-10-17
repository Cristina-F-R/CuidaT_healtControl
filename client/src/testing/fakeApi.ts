import { vi } from 'vitest';
import type { Mock } from 'vitest';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

export type FakeHandler = (request: FakeRequest) => Response | Promise<Response>;

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/**
 * A `fetch` replacement for tests. Routes are "METHOD /api/path" with `:param` segments;
 * unknown routes answer 404 in the API error shape. Install it with `vi.stubGlobal('fetch', ...)`.
 */
export function fakeApi(routes: Record<string, FakeHandler>): Mock<(input: string, init?: RequestInit) => Promise<Response>> {
  const compiled = Object.entries(routes).map(([key, handler]) => {
    const [method = 'GET', pattern = '/'] = key.split(' ');
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    return { method, regex, handler };
  });
  return vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input, 'http://localhost');
    const method = init?.method ?? 'GET';
    const route = compiled.find((candidate) => candidate.method === method && candidate.regex.test(url.pathname));
    if (!route) {
      return jsonResponse(404, { error: { code: 'NOT_FOUND', message: `Sin ruta falsa para ${method} ${url.pathname}` } });
    }
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    return route.handler({ method, path: url.pathname, query: url.searchParams, body });
  });
}

/** Calls made to the fake, as "METHOD /api/path". */
export function callsOf(fetchMock: Mock<(input: string, init?: RequestInit) => Promise<Response>>): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${new URL(input, 'http://localhost').pathname}`);
}
