import { buildReportSnapshot } from '@cuidat/shared';
import type { CalendarProfile, HealthEventLog, HealthItemDefinition, SavedReport } from '@cuidat/shared';
import type { DynamicContent } from 'pdfmake/interfaces';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../theme/palette';
import { buildReportDocument, PDF_FONT } from './reportDocument';

const CAL = '00000000-0000-4000-8000-000000000001';
const profile: CalendarProfile = {
  id: CAL, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'peach', correlationWindowHours: 2, createdAt: '2026-01-01T00:00:00.000Z',
};
function item(n: number, name: string, category: HealthItemDefinition['category']): HealthItemDefinition {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return { id, calendarId: CAL, rootId: id, parentId: null, name, emoji: '🐟', category, trackIntensity: true, trackDuration: false, status: 'active', createdAt: profile.createdAt };
}
const fish = item(10, 'Pescado', 'trigger');
const vomit = item(11, 'Vómito', 'symptom');

function report(days: number[]): SavedReport {
  const logs = days.flatMap((day, index): HealthEventLog[] => {
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    return [
      { id: `t${index}`, calendarId: CAL, itemDefinitionId: fish.id, loggedAt: `${date}T08:00:00.000Z`, intensity: null, durationMinutes: null, notes: null, createdAt: `${date}T08:00:00.000Z`, updatedAt: `${date}T08:00:00.000Z` },
      { id: `s${index}`, calendarId: CAL, itemDefinitionId: vomit.id, loggedAt: `${date}T09:00:00.000Z`, intensity: 3, durationMinutes: null, notes: 'Tras la cena', createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z` },
    ];
  });
  const snapshot = buildReportSnapshot({
    profile, items: [fish, vomit], logs, from: '2026-09-20', to: '2026-10-20', timeZone: 'UTC',
    symptomRootIds: [vomit.id], triggerRootIds: [fish.id], generatedAt: '2026-10-21T10:00:00.000Z',
  });
  return { id: '00000000-0000-4000-8000-000000000099', calendarId: CAL, calendarName: 'Luna', title: 'Visita', periodFrom: '2026-09-20', periodTo: '2026-10-20', createdAt: '2026-10-21T10:00:00.000Z', snapshot };
}

describe('PDF of a saved report (TECH_SPEC.md section 9.1)', () => {
  it('uses the CuidaT font and colors and keeps the order of the on-screen view', () => {
    const document = buildReportDocument(report([3, 4, 5]));
    expect(document.info?.title).toBe('Visita');
    expect(document.defaultStyle?.font).toBe(PDF_FONT);
    const text = JSON.stringify(document.content);
    const order = ['Visita', 'Luna · Mascota', 'Ventana de correlación: 2 horas', 'Patrones', 'Resumen por ítem', 'Calendarios', 'Registros día a día'];
    expect(order.map((part) => text.indexOf(part))).toEqual([...order.map((part) => text.indexOf(part))].sort((a, b) => a - b));
    expect(text).toContain('Pescado, seguido de Vómito');
    expect(text).toContain('3 coincidencias');
    expect(text).toContain('Notas: Tras la cena');
    expect(text).toContain('Intensidad: Grave');
    // The calendar's color band, a watch day filled with sun, and one table per month of the period.
    expect(text).toContain(PALETTE.peach);
    expect(text).toContain(PALETTE.sun);
    expect(text.match(/"widths":\["\*","\*","\*","\*","\*","\*","\*"\]/g)).toHaveLength(2);
    // The font has neither emoji nor arrows: patterns are written as text and, without images, items show their initial.
    expect(text).not.toContain('🐟');
    expect(text).not.toContain('→');
    expect(text).not.toMatch(/S d · T d/);
    expect(text).toContain('Cada icono es un registro de ese ítem.');
  });

  it('draws each log of a day as the image of its emoji, with a legend of the items', () => {
    const image = 'data:image/png;base64,AAAA';
    const document = buildReportDocument(report([3]), new Map([['🐟', image]]));
    const text = JSON.stringify(document.content);
    // Legend (2 items) + statistics (2 items) + the day of the month (2 logs).
    expect(text.split(image).length - 1).toBe(6);
    expect(text).toContain('"text":"Pescado"');
  });

  it('says so when there are no patterns or logs, and numbers the pages', () => {
    const document = buildReportDocument(report([]));
    const text = JSON.stringify(document.content);
    expect(text.match(/Ninguno en este periodo./g)).toHaveLength(2);
    expect(text).toContain('No hay registros de los ítems elegidos en este periodo.');
    const footer = document.footer as DynamicContent;
    expect(JSON.stringify(footer(2, 3, { width: 595, height: 842, orientation: 'portrait' }))).toContain('Página 2 de 3');
  });
});
