import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './useAuthStore';

const USER = { id: '7d4f3c1e-2b6a-4f7e-9a1c-3e5b8d2f6a90', email: 'ana@example.com' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, call = 0): unknown {
  const [, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the session from /me', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { user: USER })));
    const store = useAuthStore();

    await store.restoreSession();

    expect(store.user).toEqual(USER);
    expect(store.isSignedIn).toBe(true);
  });

  it('stays signed out without a session, with the server down or on a server error', async () => {
    const store = useAuthStore();
    const answers = [
      vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } })),
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      vi.fn().mockResolvedValue(jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' } })),
    ];
    for (const fetchMock of answers) {
      vi.stubGlobal('fetch', fetchMock);
      await store.restoreSession();
      expect(store.user).toBeNull();
    }
  });

  it('switches to the API data source when signed in', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { user: USER })));
    const store = useAuthStore();
    expect(store.authMode).toBe('guest');

    await store.login({ email: USER.email, password: 'una contraseña larga' });

    expect(store.user).toEqual(USER);
    expect(store.authMode).toBe('authenticated');
    expect(store.isGuest).toBe(false);
  });

  it('sends the stored guest calendar on registration and then removes the local copy (ADR-020)', async () => {
    const guestDocument = { version: 1, profiles: [{ id: 'p' }], items: [], logs: [] };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestDocument));
    localStorage.setItem(`${GUEST_STORAGE_KEY}.corrupto`, '{roto');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { user: USER }));
    vi.stubGlobal('fetch', fetchMock);
    const store = useAuthStore();

    await store.register({ email: USER.email, password: 'una contraseña larga' });

    expect(requestBody(fetchMock)).toEqual({ email: USER.email, password: 'una contraseña larga', guestData: guestDocument });
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`${GUEST_STORAGE_KEY}.corrupto`)).toBeNull();
    expect(store.user).toEqual(USER);
  });

  it('keeps the guest calendar when the registration fails', async () => {
    const guestDocument = { version: 1, profiles: [{ id: 'p' }], items: [], logs: [] };
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestDocument));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: 'EMAIL_TAKEN', message: 'x' } })));
    const store = useAuthStore();

    await expect(store.register({ email: USER.email, password: 'una contraseña larga' })).rejects.toThrow();

    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();
    expect(store.user).toBeNull();
  });

  it('registers without guest data when nothing is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { user: USER }));
    vi.stubGlobal('fetch', fetchMock);

    await useAuthStore().register({ email: USER.email, password: 'una contraseña larga' });

    expect(requestBody(fetchMock)).toMatchObject({ guestData: null });
  });

  it('forgets the user on logout and on resetState', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { user: USER }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(200, { user: USER })));
    const store = useAuthStore();

    await store.login({ email: USER.email, password: 'x' });
    await store.logout();
    expect(store.user).toBeNull();

    await store.login({ email: USER.email, password: 'x' });
    store.resetState();
    expect(store.user).toBeNull();
    expect(store.authMode).toBe('guest');
  });

  it('keeps the session when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { user: USER }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')));
    const store = useAuthStore();

    await store.login({ email: USER.email, password: 'x' });
    await expect(store.logout()).rejects.toThrow();
    expect(store.user).toEqual(USER);
  });
});
