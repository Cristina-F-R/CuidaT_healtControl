import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// Phase 4: registration without migrating local data, onboarding, calendar CRUD and the 3M view.
const PASSWORD = 'contraseña-e2e-segura-2026';

function uniqueEmail(): string {
  return `e2e-cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerWithoutMigration(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Crear cuenta', pressed: false }).click();
  await dialog.getByLabel('Email').fill(uniqueEmail());
  await dialog.getByLabel('Contraseña').fill(PASSWORD);
  await dialog.getByLabel('Conservar y migrar datos locales existentes a mi cuenta').uncheck();
  await dialog.locator('button[type="submit"]').click();
}

test('an account created without migration goes through the onboarding and manages its calendars', async ({ page }) => {
  await registerWithoutMigration(page);

  // Onboarding: only name and type.
  await expect(page.getByRole('heading', { name: 'Crea tu primer calendario' })).toBeVisible();
  await page.getByLabel('Nombre').fill('Ana');
  await page.getByLabel('Tipo de perfil').fill('Adulto');
  await page.getByRole('button', { name: 'Crear calendario' }).click();
  await expect(page.getByText('Historial de Ana')).toBeVisible();

  // Empty dock: sample items.
  await page.getByRole('button', { name: 'Añadir ítems de ejemplo' }).click();
  await expect(page.locator('button[aria-pressed]').filter({ hasText: 'Vómito' })).toBeVisible();

  // A single calendar cannot be deleted (ADR-003).
  await page.getByRole('button', { name: 'Calendarios' }).click();
  await page.getByRole('button', { name: 'Editar calendario' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar calendario' });
  await expect(edit.getByText('No puedes eliminar tu único calendario')).toBeVisible();
  await edit.getByLabel('Nombre').fill('Ana M.');
  await edit.getByLabel('Ventana de correlación').selectOption('12');
  await edit.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Historial de Ana M.')).toBeVisible();

  // A second calendar (the type list offers the one already used), then delete it.
  await page.getByRole('button', { name: 'Calendarios' }).click();
  await page.getByRole('button', { name: 'Nuevo calendario' }).click();
  const create = page.getByRole('dialog', { name: 'Nuevo calendario' });
  await create.getByLabel('Nombre').fill('Luna');
  await create.getByLabel('Tipo de perfil').fill('Mascota');
  await create.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Historial de Luna')).toBeVisible();

  await page.getByRole('button', { name: 'Calendarios' }).click();
  await page.getByRole('button', { name: 'Editar calendario' }).click();
  const remove = page.getByRole('dialog', { name: 'Editar calendario' });
  await remove.getByRole('button', { name: 'Eliminar calendario' }).click();
  await remove.getByRole('button', { name: 'Sí, eliminar' }).click();
  await expect(page.getByText('Historial de Ana M.')).toBeVisible();
});

test('guests are locked out of the density selector, and accounts stack three months', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3M' }).click();
  await expect(page.getByText('Opción no disponible sin iniciar sesión.')).toBeVisible();
  await expect(page.getByRole('button', { name: '1M' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Crear cuenta', pressed: false }).click();
  await dialog.getByLabel('Email').fill(uniqueEmail());
  await dialog.getByLabel('Contraseña').fill(PASSWORD);
  await dialog.locator('button[type="submit"]').click();
  await expect(page.locator('header').getByRole('status')).toHaveText('Sincronizado');

  await page.getByRole('button', { name: '3M' }).click();
  await expect(page.getByRole('button', { name: '3M' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('section[aria-labelledby="calendar-title"] h3')).toHaveCount(3);

  await page.getByRole('button', { name: 'Ver resúmenes' }).click();
  await expect(page.getByRole('dialog', { name: 'Resúmenes y correlaciones' })).toBeVisible();
});
