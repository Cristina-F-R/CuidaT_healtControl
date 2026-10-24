import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// Phase 4.6: saved reports (TECH_SPEC.md section 9.1) against the real API, including the PDF built
// in the browser with pdfmake.
const PASSWORD = 'contraseña-e2e-segura-2026';
const DAY = 86_400_000;
const HOUR = 3_600_000;

function uniqueEmail(): string {
  return `e2e-report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Pescado one hour before Vómito on three earlier days, through the API: "Vigilar posible patrón". */
async function seedPattern(api: APIRequestContext, origin: string): Promise<void> {
  const headers = { 'X-CuidaT-Client': 'web', Origin: origin };
  const profiles = (await (await api.get('/api/profiles')).json()) as { profiles: { id: string }[] };
  const calendar = profiles.profiles[0]!.id;
  const items = (await (await api.get(`/api/profiles/${calendar}/items`)).json()) as { items: { id: string; name: string }[] };
  const idOf = (name: string): string => items.items.find((item) => item.name === name)!.id;
  for (const daysAgo of [2, 3, 4]) {
    for (const [name, offset] of [['Pescado', 0], ['Vómito', HOUR]] as const) {
      const at = new Date(Date.now() - daysAgo * DAY + offset).toISOString();
      const response = await api.put(`/api/profiles/${calendar}/events/${crypto.randomUUID()}`, {
        headers,
        data: { itemDefinitionId: idOf(name), loggedAt: at, intensity: name === 'Vómito' ? 2 : null, durationMinutes: null, notes: null, createdAt: at, updatedAt: at },
      });
      expect(response.ok()).toBe(true);
    }
  }
}

test('a registered user saves a report, reads it, downloads its PDF and deletes it', async ({ page, baseURL }) => {
  // Register keeping the guest calendar (Moby with the sample items).
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const auth = page.getByRole('dialog');
  await auth.getByRole('button', { name: 'Crear cuenta', pressed: false }).click();
  await auth.getByLabel('Email').fill(uniqueEmail());
  await auth.getByLabel('Contraseña').fill(PASSWORD);
  await auth.locator('button[type="submit"]').click();
  await expect(page.getByText('Sincronizado')).toBeVisible();
  await seedPattern(page.request, baseURL!);

  // Save the selection of «Ver resúmenes» as a report.
  await page.getByRole('button', { name: 'Ver resúmenes' }).click();
  const summaries = page.getByRole('dialog', { name: 'Resúmenes y correlaciones' });
  await summaries.getByLabel('Título (opcional)').fill('Visita E2E');
  await summaries.getByRole('button', { name: 'Guardar informe' }).click();
  await expect(page.getByText('Informe guardado en «Informes guardados».')).toBeVisible();
  await summaries.getByRole('button', { name: 'Cerrar' }).click();

  // Read it on screen.
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  await page.getByRole('button', { name: 'Informes guardados' }).click();
  const list = page.getByRole('dialog', { name: 'Informes guardados' });
  await expect(list.getByText('1 de 5 informes')).toBeVisible();
  await list.getByRole('button', { name: 'Ver Visita E2E' }).click();
  const view = page.getByRole('dialog', { name: 'Visita E2E' });
  await expect(view.getByRole('heading', { name: 'Patrones' })).toBeVisible();
  await expect(view.getByRole('listitem').filter({ hasText: /Pescado → .* Vómito/ }).first()).toContainText('3 coincidencias');

  // Download the PDF: a real file, generated in the browser.
  const downloading = page.waitForEvent('download');
  await view.getByRole('button', { name: 'Descargar PDF' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^cuidat-informe-moby-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = await readFile(await download.path());
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.length).toBeGreaterThan(5_000);
  await view.getByRole('button', { name: 'Cerrar' }).click();

  // Delete it.
  await list.getByRole('button', { name: 'Eliminar Visita E2E' }).click();
  await list.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(list.getByText('Todavía no has guardado ningún informe.')).toBeVisible();
});
