import { apiErrorBodySchema } from '@cuidat/shared';

/** An answer of the API with an error status. `code` and `message` come from the server body. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: readonly string[];

  constructor(status: number, code: string, message: string, fields: readonly string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** The request never got an answer: no connection, or the server is down. */
export class NetworkError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor.');
    this.name = 'NetworkError';
  }
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// Development: the API runs on another port (VITE_API_URL). Production: same origin, relative paths.
const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

/**
 * Calls the API with the session cookie (`credentials: 'include'`) and the CSRF header
 * `X-CuidaT-Client: web` (TECH_SPEC.md section 7). Returns the parsed JSON body, or `null` for 204.
 */
export async function apiRequest(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
  const headers: Record<string, string> = { 'X-CuidaT-Client': 'web' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 204) {
    return null;
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorBodySchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      throw new ApiError(response.status, code, message, fields);
    }
    throw new ApiError(response.status, 'HTTP_ERROR', 'El servidor no pudo atender la petición.');
  }
  return payload;
}
