import { expect, test } from '@playwright/test';

// Phase 4.5: global consultation mode (TECH_SPEC.md use case 12), as a guest with seeded data.
// The data are seeded in the guest key instead of being created through the UI, and the browser clock
// is fixed so that the seeded month is the current one (guests only see the current month).
const MONTH = '2026-10';
const NOW = new Date(`${MONTH}-20T12:00:00`);
const CALENDAR_ID = '00000000-0000-4000-8000-000000000001';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function instant(day: number, time: string): string {
  return new Date(`${MONTH}-${String(day).padStart(2, '0')}T${time}:00`).toISOString();
}

/**
 * Same scenario as client/src/testing/patternGuestDocument.ts (window 2 h): Pescado -> Vómito on days
 * 2-4 ("Vigilar posible patrón") and Lácteos -> Malestar on days 6-12 ("Patrón detectado").
 */
function guestDocument(): string {
  const createdAt = instant(1, '00:00');
  const item = (n: number, name: string, emoji: string, category: string): Record<string, unknown> => ({
    id: uuid(n), calendarId: CALENDAR_ID, rootId: uuid(n), parentId: null, name, emoji, category,
    trackIntensity: true, trackDuration: false, status: 'active', createdAt,
  });
  const items = [item(10, 'Pescado', '🐟', 'trigger'), item(11, 'Vómito', '🤮', 'symptom'), item(12, 'Lácteos', '🥛', 'trigger'), item(13, 'Malestar', '😣', 'symptom')];
  const logs: Record<string, unknown>[] = [];
  const log = (itemN: number, day: number, time: string): void => {
    const loggedAt = instant(day, time);
    logs.push({
      id: uuid(100 + logs.length), calendarId: CALENDAR_ID, itemDefinitionId: uuid(itemN), loggedAt,
      intensity: null, durationMinutes: null, notes: null, createdAt: loggedAt, updatedAt: loggedAt,
    });
  };
  for (const day of [2, 3, 4]) {
    log(10, day, '08:00');
    log(11, day, '09:00');
  }
  for (const day of [6, 7, 8, 9, 10, 11, 12]) {
    log(12, day, '08:00');
    log(13, day, '09:00');
  }
  const profile = { id: CALENDAR_ID, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'slate', correlationWindowHours: 2, createdAt };
  return JSON.stringify({ version: 1, profiles: [profile], items, logs });
}

test('consultation mode hides editing, widens the calendar and marks the pattern days', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((document) => {
    // Only the first load: later reloads keep whatever the app stored.
    if (!window.sessionStorage.getItem('seeded')) {
      window.localStorage.setItem('@cuidat_guest_v1', document);
      window.sessionStorage.setItem('seeded', 'true');
    }
  }, guestDocument());
  await page.goto('/');

  const dock = page.getByRole('heading', { name: 'Añadir al día' });
  const consultation = page.getByRole('switch', { name: 'Modo consulta' });
  await expect(dock).toBeVisible();
  await expect(consultation).toHaveAttribute('aria-checked', 'false');

  await consultation.click();
  await expect(consultation).toHaveAttribute('aria-checked', 'true');
  await expect(dock).toBeHidden();
  await expect(page.getByRole('button', { name: /, 3 de octubre de 2026, .* · Vigilar posible patrón$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /, 8 de octubre de 2026, .* · Patrón detectado$/ })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Leyenda del modo consulta' })).toBeVisible();

  // A log opens with all its details and without any editing action.
  await page.getByRole('button', { name: 'Vómito, 09:00. Ver registro' }).first().click();
  const detail = page.getByRole('dialog', { name: 'Detalle del registro' });
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Eliminar registro' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Cerrar' }).click();

  // Turned off: everything comes back.
  await consultation.click();
  await expect(dock).toBeVisible();
  await expect(page.getByRole('button', { name: /· Patrón detectado$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Vómito, 09:00. Ver registro' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Editar registro' }).getByRole('button', { name: 'Eliminar registro' })).toBeVisible();
});
