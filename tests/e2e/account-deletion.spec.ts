import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// ADR-008: the right to be forgotten (GDPR Art. 17) must be covered end to end.
const PASSWORD = 'contraseña-e2e-segura-2026';
const GUEST_KEY = '@cuidat_guest_v1';
const GUEST_BACKUP_KEY = '@cuidat_guest_v1.corrupto';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function submitAuthForm(page: Page, email: string, password: string): Promise<void> {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Contraseña').fill(password);
  await dialog.locator('button[type="submit"]').click();
}

async function openAccountMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
}

async function guestProfileId(page: Page): Promise<string | undefined> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const document: unknown = raw ? JSON.parse(raw) : null;
    if (typeof document !== 'object' || document === null || !('profiles' in document) || !Array.isArray(document.profiles)) {
      return undefined;
    }
    const first: unknown = document.profiles[0];
    return typeof first === 'object' && first !== null && 'id' in first && typeof first.id === 'string' ? first.id : undefined;
  }, GUEST_KEY);
}

test('a registered user deletes the account and the app returns to «Modo Local»', async ({ page }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await expect(page.getByRole('status').filter({ hasText: 'Modo Local' })).toBeVisible();

  // Registration.
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Crear cuenta', pressed: false }).click();
  await submitAuthForm(page, email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Menú de la cuenta' })).toBeVisible();
  // The guest calendar moved to the account: the browser copy is gone (ADR-020) and the data comes from the API.
  await expect(page.getByRole('status').filter({ hasText: 'Sincronizado' })).toBeVisible();
  expect(await guestProfileId(page)).toBeUndefined();

  // Sign out and sign in again with the same credentials.
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await submitAuthForm(page, email, PASSWORD);
  await expect(page.getByRole('button', { name: 'Menú de la cuenta' })).toBeVisible();

  // Local leftovers that the deletion must purge.
  await page.evaluate((key) => localStorage.setItem(key, '{roto'), GUEST_BACKUP_KEY);

  // The modal: the confirm button stays disabled until the exact word is typed.
  await openAccountMenu(page);
  await page.getByRole('button', { name: 'Eliminar cuenta y datos' }).click();
  const dialog = page.getByRole('dialog', { name: 'Eliminar cuenta y datos' });
  const confirm = dialog.getByRole('button', { name: 'Eliminar definitivamente' });
  const word = dialog.getByLabel('Escribe ELIMINAR para confirmar');
  await expect(confirm).toBeDisabled();
  await word.fill('eliminar');
  await expect(confirm).toBeDisabled();
  await word.fill('ELIMINA');
  await expect(confirm).toBeDisabled();
  await word.fill('ELIMINAR');
  await expect(confirm).toBeEnabled();

  const deletion = page.waitForResponse((response) => response.url().endsWith('/api/auth/account') && response.request().method() === 'DELETE');
  await confirm.click();
  expect((await deletion).status()).toBe(204);

  // Back to a fresh guest workspace.
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Modo Local' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menú de la cuenta' })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), GUEST_BACKUP_KEY)).toBeNull();
  expect(await guestProfileId(page)).toBeDefined();

  // The session is gone, and so is the account: the same credentials no longer work.
  const me = await page.request.get('/api/auth/me');
  expect(me.status()).toBe(401);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await submitAuthForm(page, email, PASSWORD);
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
});
