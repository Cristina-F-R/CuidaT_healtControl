import { GUEST_LOCKED_WARNING, GUEST_STORAGE_KEY } from '@cuidat/shared';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { useCalendar } from './application/composables/useCalendar';
import { resetMonthDensity } from './application/composables/useMultiMonth';
import { useOverlays } from './application/composables/useOverlays';
import { resetDataLayerForTests } from './infrastructure/repositories/createRepositories';
import { createMemoryStore } from './infrastructure/sync/keyValueStore';
import { jsonResponse } from './testing/fakeApi';
import { createFakeServer } from './testing/fakeServer';

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
  );
  if (!found) {
    throw new Error(`Falta el botón «${name}»`);
  }
  return found;
}

async function click(root: ParentNode, name: string): Promise<void> {
  buttonNamed(root, name).click();
  await flushPromises();
}

function setValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function dialog(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!found) {
    throw new Error('No hay ningún diálogo abierto');
  }
  return found;
}

function stubNoSession(): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } })));
}

describe('App (Phase 4: calendars, navigation and analytics)', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    resetMonthDensity();
    useCalendar().goToday();
    useOverlays().closeAllOverlays();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  async function mountApp(): Promise<VueWrapper> {
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
    return wrapper;
  }

  it('locks the month jump and the 2M/3M density for guests with the warning', async () => {
    stubNoSession();
    const app = await mountApp();

    expect(app.findAll('h3').filter((heading) => /\d{4}$/.test(heading.text()))).toHaveLength(0);
    await click(document.body, 'Elegir mes y año');
    expect(document.body.textContent).toContain(GUEST_LOCKED_WARNING);
    expect(document.querySelector<HTMLElement>('[aria-label="Saltar a un mes"]')?.style.display).toBe('none');

    await click(document.body, '3M');
    expect(document.querySelector('[aria-label="Meses visibles"] [aria-pressed="true"]')?.textContent?.trim()).toBe('1M');
    expect(buttonNamed(document.body, 'Crear cuenta')).toBeDefined();
  });

  it('stacks three months for a registered user and jumps to another month and year', async () => {
    vi.stubGlobal('fetch', createFakeServer(true).fetch);
    const app = await mountApp();

    await click(document.body, '3M');
    const titles = app.findAll('h3').map((heading) => heading.text()).filter((text) => /\d{4}$/.test(text));
    expect(titles).toHaveLength(3);
    expect(titles[0]?.toLowerCase()).toBe(dayjs().format('MMMM YYYY').toLowerCase());

    // Quick jump: previous year, March. Future months of the current year are disabled.
    await click(document.body, 'Elegir mes y año');
    const panel = document.querySelector<HTMLElement>('[aria-label="Saltar a un mes"]')!;
    const lastMonthButton = Array.from(panel.querySelectorAll<HTMLButtonElement>('li button')).at(-1)!;
    expect(lastMonthButton.disabled).toBe(dayjs().month() < 11);
    await click(panel, 'Año anterior');
    panel.querySelectorAll<HTMLButtonElement>('li button')[2]!.click();
    await flushPromises();

    const march = dayjs(`${dayjs().year() - 1}-03-01`).format('MMMM YYYY');
    expect(app.text().toLowerCase()).toContain(march.toLowerCase());
    expect(buttonNamed(document.body, 'Año siguiente')).toBeDefined();
  });

  it('shows «Crea tu primer calendario» for an account without calendars and then opens it', async () => {
    const server = createFakeServer(true);
    server.profiles = [];
    server.items.length = 0;
    vi.stubGlobal('fetch', server.fetch);
    const app = await mountApp();

    expect(app.text()).toContain('Crea tu primer calendario');
    expect(app.text()).not.toContain('Historial de');
    expect(app.findAll('input').map((input) => input.attributes('type'))).not.toContain('checkbox');

    setValue(app.find('input[type="text"]').element as HTMLInputElement, 'Ana');
    setValue(app.find('input[role="combobox"]').element as HTMLInputElement, 'Adulto');
    app.find('form').element.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(app.text()).toContain('Historial de Ana');
    // The empty dock offers the sample items.
    await click(document.body, 'Añadir ítems de ejemplo');
    expect(app.text()).toContain('Vómito');
    expect(app.text()).not.toContain('Añadir ítems de ejemplo');
  });

  it('registers without migrating the guest data when the switch is turned off', async () => {
    const server = createFakeServer(false);
    server.profiles = [];
    vi.stubGlobal('fetch', server.fetch);
    const app = await mountApp();
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull();

    await click(document.body, 'Iniciar sesión');
    await click(dialog(), 'Crear cuenta');
    const migrate = dialog().querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(migrate.checked).toBe(true);
    expect(dialog().textContent).toContain('Conservar y migrar datos locales existentes a mi cuenta');
    migrate.click();
    await flushPromises();
    setValue(dialog().querySelector<HTMLInputElement>('input[type="email"]')!, 'ana@example.com');
    setValue(dialog().querySelector<HTMLInputElement>('input[type="password"]')!, 'una contraseña larga');
    dialog().querySelector('form')!.dispatchEvent(new Event('submit'));
    await flushPromises();

    expect(server.registerBodies).toEqual([{ email: 'ana@example.com', password: 'una contraseña larga' }]);
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
    expect(app.text()).toContain('Crea tu primer calendario');
  });

  it('migrates the guest data by default', async () => {
    const server = createFakeServer(false);
    vi.stubGlobal('fetch', server.fetch);
    await mountApp();

    await click(document.body, 'Iniciar sesión');
    await click(dialog(), 'Crear cuenta');
    setValue(dialog().querySelector<HTMLInputElement>('input[type="email"]')!, 'ana@example.com');
    setValue(dialog().querySelector<HTMLInputElement>('input[type="password"]')!, 'una contraseña larga');
    dialog().querySelector('form')!.dispatchEvent(new Event('submit'));
    await flushPromises();

    const body = server.registerBodies[0] as { guestData?: { profiles: { name: string }[] } };
    expect(body.guestData?.profiles[0]?.name).toBe('Moby');
    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });

  it('edits the calendar from the header menu and explains why the last one cannot be deleted', async () => {
    stubNoSession();
    const app = await mountApp();

    await click(document.body, 'Calendarios');
    await click(document.body, 'Editar calendario');
    const form = dialog();
    expect(form.textContent).toContain('Editar calendario');
    expect(form.textContent).toContain('No puedes eliminar tu único calendario');
    expect(Array.from(form.querySelectorAll('select option')).map((option) => option.textContent?.trim())).toEqual([
      '2 horas', '6 horas', '12 horas', '24 horas', '36 horas', '48 horas',
    ]);

    const colors = form.querySelector('[aria-label="Color del calendario"]')!;
    expect(colors.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe('Gris');

    setValue(form.querySelector<HTMLInputElement>('input[type="text"]')!, 'Rex');
    setValue(form.querySelector<HTMLSelectElement>('select')!, '12');
    await click(colors, 'Menta');
    await click(form, 'Guardar');

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(app.text()).toContain('Historial de Rex');
    expect(app.text()).toContain('Rex · Mascota');
    expect(buttonNamed(document.body, 'Calendarios').querySelector('.bg-mint')).not.toBeNull();
  });

  it('refuses a second calendar for guests and opens the creation form for accounts', async () => {
    stubNoSession();
    await mountApp();
    await click(document.body, 'Calendarios');
    await click(document.body, 'Nuevo calendario');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).toContain(GUEST_LOCKED_WARNING);
    wrapper?.unmount();
    wrapper = null;
    document.body.innerHTML = '';

    setActivePinia(createPinia());
    vi.stubGlobal('fetch', createFakeServer(true).fetch);
    await mountApp();
    await click(document.body, 'Calendarios');
    await click(document.body, 'Nuevo calendario');
    expect(dialog().textContent).toContain('Nuevo calendario');
    const options = Array.from(dialog().querySelectorAll('datalist option')).map((option) => option.getAttribute('value'));
    expect(options).toEqual(['Mascota', 'Niño/a', 'Adulto']);
  });

  it('opens the correlation filter from «Ver resúmenes»', async () => {
    stubNoSession();
    await mountApp();

    await click(document.body, 'Ver resúmenes');

    expect(dialog().textContent).toContain('Resúmenes y correlaciones');
    expect(dialog().textContent).toContain(GUEST_LOCKED_WARNING);
    expect(dialog().querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
  });
});
