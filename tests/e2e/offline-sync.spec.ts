import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ADR-007: logs recorded without connection are queued and synced when the connection returns.
const PASSWORD = 'contraseña-e2e-segura-2026';

function uniqueEmail(): string {
  return `e2e-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Selects «Vómito» in the dock and logs it on today's cell. */
async function logVomitToday(page: Page): Promise<void> {
  const dockItem = page.locator('button[aria-pressed]').filter({ hasText: 'Vómito' });
  if ((await dockItem.getAttribute('aria-pressed')) !== 'true') {
    await dockItem.click();
  }
  await page.getByRole('button', { name: /\(hoy\), \d+ registros?$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo registro' });
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(dialog).toBeHidden();
}

async function countServerLogs(page: Page): Promise<number> {
  const profiles = (await (await page.request.get('/api/profiles')).json()) as { profiles: { id: string }[] };
  const calendar = profiles.profiles[0]?.id ?? '';
  const events = (await (await page.request.get(`/api/profiles/${calendar}/events`)).json()) as { logs: unknown[] };
  return events.logs.length;
}

test('logs recorded offline are queued, shown as pending and synced when back online', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Crear cuenta', pressed: false }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(uniqueEmail());
  await dialog.getByLabel('Contraseña').fill(PASSWORD);
  await dialog.locator('button[type="submit"]').click();
  const status = page.locator('header').getByRole('status');
  await expect(status).toHaveText('Sincronizado');

  // Online: sent right away.
  await logVomitToday(page);
  await expect(status).toHaveText('Sincronizado');
  expect(await countServerLogs(page)).toBe(1);

  // Offline: kept in the queue and visible in the calendar.
  await context.setOffline(true);
  await expect(status).toHaveText('Sin conexión');
  await logVomitToday(page);
  await expect(page.getByRole('button', { name: /\(hoy\), 2 registros$/ })).toBeVisible();

  // Back online: the queue is flushed by the `online` event.
  await context.setOffline(false);
  await expect(status).toHaveText('Sincronizado');
  expect(await countServerLogs(page)).toBe(2);

  // A reload reads both from the server.
  await page.reload();
  await expect(page.getByRole('button', { name: /\(hoy\), 2 registros$/ })).toBeVisible();

  // Clean up the test account.
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
  await page.getByRole('button', { name: 'Eliminar cuenta y datos' }).click();
  await page.getByLabel('Escribe ELIMINAR para confirmar').fill('ELIMINAR');
  await page.getByRole('button', { name: 'Eliminar definitivamente' }).click();
  await expect(status).toHaveText('Modo Local');
});
