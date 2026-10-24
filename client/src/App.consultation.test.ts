import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { useCalendar } from './application/composables/useCalendar';
import { resetMonthDensity } from './application/composables/useMultiMonth';
import { useOverlays } from './application/composables/useOverlays';
import { resetViewMode } from './application/composables/useViewMode';
import { resetDataLayerForTests } from './infrastructure/repositories/createRepositories';
import { createMemoryStore } from './infrastructure/sync/keyValueStore';
import { jsonResponse } from './testing/fakeApi';
import { buildPatternGuestDocument, DETECTED_DAYS, UNMARKED_DAY, WATCH_DAYS } from './testing/patternGuestDocument';

// Phase 4.5: global consultation mode (TECH_SPEC.md use case 12). The clock is fixed so the seeded
// month is the current one, as guests only see the current month.
const MONTH = '2026-10';
const NOW = new Date(`${MONTH}-20T12:00:00`);

function dayKey(day: number): string {
  return `${MONTH}-${String(day).padStart(2, '0')}`;
}

/** The "day" button of a cell, by the date its label starts with. */
function dayButton(day: number): HTMLButtonElement {
  const date = dayjs(dayKey(day)).format('dddd, D [de] MMMM [de] YYYY');
  const found = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).find((button) =>
    button.getAttribute('aria-label')!.startsWith(date),
  );
  if (!found) {
    throw new Error(`Falta el día ${day}`);
  }
  return found;
}

function buttonNamed(name: string, root: ParentNode = document.body): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
  );
}

async function click(button: HTMLButtonElement | undefined): Promise<void> {
  if (!button) {
    throw new Error('Falta el botón');
  }
  button.click();
  await flushPromises();
}

function consultationSwitch(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('button[role="switch"]')!;
}

function dialog(): HTMLElement {
  return document.querySelector<HTMLElement>('[role="dialog"]')!;
}

describe('App (Phase 4.5: consultation mode)', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(buildPatternGuestDocument(MONTH)));
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    resetMonthDensity();
    resetViewMode();
    useCalendar().goToday();
    useOverlays().closeAllOverlays();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } })));
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('starts off, with the dock and no day marks', () => {
    expect(consultationSwitch().getAttribute('aria-checked')).toBe('false');
    expect(consultationSwitch().textContent).toContain('Modo consulta');
    expect(document.querySelector('#dock-title')).not.toBeNull();
    expect(dayButton(WATCH_DAYS[0]).getAttribute('aria-label')).not.toContain('patrón');
  });

  it('hides the dock and marks the symptom days of each pattern, detected over watch', async () => {
    await click(consultationSwitch());

    expect(consultationSwitch().getAttribute('aria-checked')).toBe('true');
    expect(document.body.textContent).toContain('Modo consulta activado');
    expect(document.querySelector('#dock-title')).toBeNull();
    for (const day of WATCH_DAYS) {
      expect(dayButton(day).getAttribute('aria-label')).toMatch(/· Vigilar posible patrón$/);
    }
    for (const day of DETECTED_DAYS) {
      expect(dayButton(day).getAttribute('aria-label')).toMatch(/· Patrón detectado$/);
    }
    expect(dayButton(UNMARKED_DAY).getAttribute('aria-label')).not.toContain('patrón');
    expect(document.querySelector('[aria-label="Leyenda del modo consulta"]')).not.toBeNull();
  });

  it('shows a log and a day without any editing action', async () => {
    await click(consultationSwitch());

    await click(buttonNamed('Vómito, 09:00. Ver registro'));
    expect(dialog().textContent).toContain('Detalle del registro');
    expect(dialog().textContent).toContain('Después de comer');
    expect(dialog().textContent).toContain('Moderada');
    expect(buttonNamed('Eliminar registro', dialog())).toBeUndefined();
    expect(buttonNamed('Guardar', dialog())).toBeUndefined();
    await click(buttonNamed('Cerrar', dialog()));

    await click(dayButton(WATCH_DAYS[0]));
    expect(dialog().querySelectorAll('li').length).toBe(2);
    expect(buttonNamed('Editar', dialog())).toBeUndefined();
    expect(buttonNamed('Eliminar', dialog())).toBeUndefined();
  });

  it('keeps calendar switching but hides calendar editing', async () => {
    await click(consultationSwitch());
    await click(buttonNamed('Calendarios'));
    expect(buttonNamed('Editar calendario')).toBeUndefined();
    expect(buttonNamed('Nuevo calendario')).toBeUndefined();
    expect(document.querySelector('[aria-label="Tus calendarios"]')).not.toBeNull();
  });

  it('brings everything back when it is turned off', async () => {
    await click(consultationSwitch());
    await click(consultationSwitch());

    expect(document.body.textContent).toContain('Modo consulta desactivado');
    expect(document.querySelector('#dock-title')).not.toBeNull();
    expect(dayButton(DETECTED_DAYS[0]).getAttribute('aria-label')).not.toContain('patrón');
    await click(buttonNamed('Vómito, 09:00. Ver registro'));
    expect(dialog().textContent).toContain('Editar registro');
  });

  it('colors the insights cards like the day marks, in either mode', () => {
    const watch = document.querySelector('[aria-labelledby="pattern-watch"] li');
    const detected = document.querySelector('[aria-labelledby="pattern-detected"] li');
    expect(watch?.classList).toContain('bg-sun');
    expect(watch?.textContent).toContain('3');
    expect(detected?.classList).toContain('bg-peach');
    expect(detected?.textContent).toContain('7');
  });
});
