import { GUEST_LOCKED_WARNING } from '@cuidat/shared';
import type { HealthEventLog } from '@cuidat/shared';
import { flushPromises, mount } from '@vue/test-utils';
import type { VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.vue';
import { useCalendar } from './application/composables/useCalendar';
import { resetMonthDensity } from './application/composables/useMultiMonth';
import { useOverlays } from './application/composables/useOverlays';
import { resetViewMode, useViewMode } from './application/composables/useViewMode';
import { resetDataLayerForTests } from './infrastructure/repositories/createRepositories';
import { createMemoryStore } from './infrastructure/sync/keyValueStore';
import { jsonResponse } from './testing/fakeApi';
import { createFakeServer } from './testing/fakeServer';
import type { FakeServer } from './testing/fakeServer';

// Phase 4.6: saved reports (TECH_SPEC.md section 9.1). The fake API builds the snapshot with the real
// builder; the PDF itself is covered by the E2E suite, so its download is replaced here.
const downloadReportPdf = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('./application/composables/useReportDownload', () => ({ downloadReportPdf }));

const NOW = new Date('2026-10-20T12:00:00');

function buttonNamed(name: string, root: ParentNode = document.body): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
  );
}

async function click(name: string, root: ParentNode = document.body): Promise<void> {
  const button = buttonNamed(name, root);
  if (!button) {
    throw new Error(`Falta el botón «${name}»`);
  }
  button.click();
  await flushPromises();
}

function dialog(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!found) {
    throw new Error('No hay ningún diálogo abierto');
  }
  return found;
}

/** Pescado one hour before Vómito on three days of the month: "Vigilar posible patrón". */
function seedPattern(server: FakeServer): void {
  const fish = server.items.find((item) => item.name === 'Pescado')!;
  const vomit = server.items.find((item) => item.name === 'Vómito')!;
  for (const day of [3, 4, 5]) {
    for (const [item, hour] of [[fish, 8], [vomit, 9]] as const) {
      const at = new Date(`2026-10-0${day}T0${hour}:00:00`).toISOString();
      const log: HealthEventLog = {
        id: `33333333-3333-4333-8333-0000000${day}${hour}000`.slice(0, 36), calendarId: server.profile.id, itemDefinitionId: item.id,
        loggedAt: at, intensity: item === vomit ? 2 : null, durationMinutes: null, notes: item === vomit ? 'Tras comer' : null, createdAt: at, updatedAt: at,
      };
      server.logs.set(log.id, log);
    }
  }
}

describe('App (Phase 4.6: saved reports)', () => {
  let wrapper: VueWrapper | null = null;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    localStorage.clear();
    setActivePinia(createPinia());
    resetDataLayerForTests(createMemoryStore());
    resetMonthDensity();
    resetViewMode();
    useCalendar().goToday();
    useOverlays().closeAllOverlays();
    downloadReportPdf.mockClear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function mountWith(server: FakeServer | null): Promise<void> {
    vi.stubGlobal('fetch', server ? server.fetch : vi.fn().mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Necesitas iniciar sesión.' } })));
    wrapper = mount(App, { attachTo: document.body });
    await flushPromises();
  }

  async function saveReport(): Promise<void> {
    await click('Ver resúmenes');
    await click('Guardar informe', dialog());
    expect(document.body.textContent).toContain('Informe guardado en «Informes guardados».');
    await click('Cerrar', dialog());
  }

  async function openReportList(): Promise<void> {
    await click('Menú de la cuenta');
    await click('Informes guardados');
  }

  it('saves the selection of «Ver resúmenes», lists it and shows it built from the snapshot', async () => {
    const server = createFakeServer(true);
    seedPattern(server);
    await mountWith(server);

    await saveReport();
    await openReportList();
    expect(dialog().textContent).toContain('1 de 5 informes');
    expect(dialog().textContent).toContain('Informe de Luna');

    await click('Ver Informe de Luna', dialog());
    const view = dialog();
    expect(view.querySelector('h2')?.textContent).toContain('Informe de Luna');
    expect(view.textContent).toContain('Ventana de correlación: 48 horas');
    const watch = Array.from(view.querySelectorAll('[aria-labelledby="report-patterns"] li'));
    expect(watch.map((entry) => entry.textContent)).toEqual([expect.stringContaining('Pescado → 🤢 Vómito')]);
    expect(watch[0]?.classList).toContain('bg-sun');
    expect(view.querySelector('[aria-label$="· Vigilar posible patrón"]')).not.toBeNull();
    expect(view.textContent).toContain('Notas: Tras comer');

    await click('Descargar PDF', view);
    expect(downloadReportPdf).toHaveBeenCalledWith(expect.objectContaining({ title: 'Informe de Luna' }));
  });

  it('keeps only what is checked in «Ver resúmenes» and says so before saving', async () => {
    const server = createFakeServer(true);
    seedPattern(server);
    await mountWith(server);

    await click('Ver resúmenes');
    const summaries = dialog();
    expect(summaries.textContent).toContain('Incluirá 3 síntomas y 3 triggers o medicaciones');
    const boxes = Array.from(summaries.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    for (const box of boxes.filter((candidate) => /Lácteos|Medicación|Heces blandas/.test(candidate.closest('label')?.textContent ?? ''))) {
      box.click();
    }
    await flushPromises();
    expect(summaries.textContent).toContain('Incluirá 2 síntomas y 1 trigger o medicación: lo que desmarques arriba no aparecerá en el informe.');
    await click('Guardar informe', summaries);

    const snapshot = server.reports[0]!.snapshot;
    expect(snapshot.items.map((item) => item.name)).toEqual(['Vómito', 'Malestar / dolor', 'Pescado']);
    expect(snapshot.itemStats.map((stats) => stats.rootId)).toEqual(snapshot.items.map((item) => item.rootId));
  });

  it('deletes a report after confirming, but never in consultation mode', async () => {
    const server = createFakeServer(true);
    await mountWith(server);
    await saveReport();

    useViewMode().setConsultationMode(true);
    await openReportList();
    expect(buttonNamed('Eliminar Informe de Luna', dialog())).toBeUndefined();
    await click('Cerrar', dialog());

    useViewMode().setConsultationMode(false);
    await openReportList();
    await click('Eliminar Informe de Luna', dialog());
    await click('Sí, eliminar', dialog());
    expect(dialog().textContent).toContain('Todavía no has guardado ningún informe.');
    expect(server.reports).toEqual([]);
  });

  it('warns that deleting a calendar also erases its saved reports', async () => {
    const server = createFakeServer(true);
    server.profiles = [server.profile, { ...server.profile, id: '11111111-1111-4111-8111-111111111112', name: 'Rex' }];
    await mountWith(server);
    await saveReport();

    await click('Calendarios');
    await click('Editar calendario');
    await click('Eliminar calendario', dialog());
    expect(dialog().textContent).toContain(
      '¿Seguro que quieres eliminar «Luna»? También se borrarán sus ítems, todos sus registros y el informe guardado de este calendario. Si quieres conservarlo, descárgalo en PDF antes de continuar.',
    );
  });

  it('keeps reports for registered users: guests get the locked warning', async () => {
    await mountWith(null);
    await click('Ver resúmenes');
    await click('Guardar informe', dialog());
    expect(document.body.textContent).toContain(GUEST_LOCKED_WARNING);
  });
});
