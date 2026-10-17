import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { resetDataLayerForTests } from './infrastructure/repositories/createRepositories';
import { createMemoryStore } from './infrastructure/sync/keyValueStore';
import { callsOf } from './testing/fakeApi';
import { createFakeServer } from './testing/fakeServer';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function bodyButton(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === text);
}

function fillInput(type: string, value: string): void {
  const input = document.querySelector<HTMLInputElement>(`[role="dialog"] input[type="${type}"]`);
  if (!input) {
    throw new Error(`Falta el campo ${type}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submitAuthForm(): Promise<void> {
  document.querySelector<HTMLFormElement>('[role="dialog"] form')!.dispatchEvent(new Event('submit'));
  await flushPromises();
}

// Smoke test of the guest workflow through the real components and local repositories.
describe('App (guest workflow)', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    // No session: GET /api/auth/me answers 401.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the seeded calendar, opens the day summary and the catalog manager', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.text()).toContain('Historial de Moby');
    expect(wrapper.text()).toContain('Vómito');

    const manage = wrapper.findAll('button').find((button) => button.text() === 'Gestionar ítems');
    expect(manage).toBeDefined();
    await manage!.trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('Gestionar ítems');
    expect(document.body.textContent).toContain('Triggers / Medicación');

    await wrapper.unmount();
  });

  it('opens the event log modal for a selected item and saves a log', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    const vomit = wrapper.findAll('button').find((button) => button.attributes('aria-pressed') !== undefined && button.text().includes('Vómito'));
    expect(vomit).toBeDefined();
    await vomit!.trigger('click');

    // Day buttons are labelled "<date>, <n> registros"; the first day of the month is never in the future.
    const dayButtons = wrapper
      .findAll('button')
      .filter((button) => (button.attributes('aria-label') ?? '').includes(' registro') && !button.attributes('aria-disabled'));
    expect(dayButtons.length).toBeGreaterThan(0);
    await dayButtons[0]!.trigger('click');
    await flushPromises();

    expect(document.body.textContent).toContain('Nuevo registro');
    expect(document.body.textContent).toContain('Vómito');

    const save = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.trim() === 'Guardar');
    expect(save).toBeDefined();
    save!.click();
    await flushPromises();

    expect(document.body.textContent).not.toContain('Nuevo registro');
    await wrapper.unmount();
  });

  it('signs in from the header, switches to the account calendars and signs out', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.text()).toContain('Modo Local');

    bodyButton('Iniciar sesión')!.click();
    await flushPromises();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Iniciar sesión');

    // Client-side validation: no request leaves with an invalid email or an empty password.
    const server = createFakeServer();
    vi.stubGlobal('fetch', server.fetch);
    fillInput('email', 'no-es-un-email');
    await submitAuthForm();
    expect(document.body.textContent).toContain('Introduce un email válido.');
    expect(document.body.textContent).toContain('Introduce la contraseña.');
    expect(server.fetch).not.toHaveBeenCalled();

    fillInput('email', 'Ana@Example.com');
    fillInput('password', 'una contraseña larga');
    await submitAuthForm();
    expect(callsOf(server.fetch)).toEqual(expect.arrayContaining(['POST /api/auth/login', 'GET /api/profiles', 'GET /api/profiles/11111111-1111-4111-8111-111111111111/items']));
    expect(document.querySelector('[role="dialog"] input[type="password"]')).toBeNull();
    // The account's calendar, from the API, and the sync state instead of «Modo Local».
    expect(wrapper.text()).toContain('Luna');
    expect(wrapper.text()).toContain('Sincronizado');

    bodyButton('Cerrar sesión')!.click();
    await flushPromises();
    expect(callsOf(server.fetch)).toContain('POST /api/auth/logout');
    expect(wrapper.text()).toContain('Moby');
    expect(wrapper.text()).toContain('Modo Local');
    expect(bodyButton('Iniciar sesión')).toBeDefined();

    await wrapper.unmount();
  });

  it('asks for 12 characters on registration and explains a taken email', async () => {
    const wrapper = mount(App, { attachTo: document.body });
    await flushPromises();

    bodyButton('Iniciar sesión')!.click();
    await flushPromises();
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button[aria-pressed]')).find((button) => button.textContent?.trim() === 'Crear cuenta')!.click();
    await flushPromises();

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, { error: { code: 'EMAIL_TAKEN', message: 'No se pudo crear la cuenta con ese email.' } }));
    vi.stubGlobal('fetch', fetchMock);
    fillInput('email', 'ana@example.com');
    fillInput('password', 'corta');
    await submitAuthForm();
    expect(document.body.textContent).toContain('La contraseña debe tener al menos 12 caracteres.');
    expect(fetchMock).not.toHaveBeenCalled();

    fillInput('password', 'una contraseña larga');
    await submitAuthForm();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Ya existe una cuenta con ese email.');

    await wrapper.unmount();
  });
});
