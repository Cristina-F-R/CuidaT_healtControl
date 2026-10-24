import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import type { GuestDocument } from '../infrastructure/repositories/guestStorage';

// Guest calendar with known patterns in one month (window 2 h, each symptom one hour after its trigger):
// - Pescado -> Vómito on days 2, 3 and 4: "Vigilar posible patrón" (3 occurrences).
// - Lácteos -> Malestar on days 6 to 12: "Patrón detectado" (7 occurrences).
// Day 15 holds a lonely symptom, so it is never marked.
export const PATTERN_CALENDAR_ID = '00000000-0000-4000-8000-000000000001';
export const WATCH_DAYS = [2, 3, 4] as const;
export const DETECTED_DAYS = [6, 7, 8, 9, 10, 11, 12] as const;
export const UNMARKED_DAY = 15;

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function item(n: number, name: string, emoji: string, category: HealthItemDefinition['category'], createdAt: string): HealthItemDefinition {
  const id = uuid(n);
  return {
    id, calendarId: PATTERN_CALENDAR_ID, rootId: id, parentId: null, name, emoji, category,
    trackIntensity: true, trackDuration: false, status: 'active', createdAt,
  };
}

export function buildPatternGuestDocument(monthKey: string): GuestDocument {
  const createdAt = new Date(`${monthKey}-01T00:00:00`).toISOString();
  const items = [
    item(10, 'Pescado', '🐟', 'trigger', createdAt),
    item(11, 'Vómito', '🤮', 'symptom', createdAt),
    item(12, 'Lácteos', '🥛', 'trigger', createdAt),
    item(13, 'Malestar', '😣', 'symptom', createdAt),
  ];
  const logs: HealthEventLog[] = [];
  const log = (itemIndex: number, day: number, time: string, notes: string | null = null): void => {
    const loggedAt = new Date(`${monthKey}-${String(day).padStart(2, '0')}T${time}:00`).toISOString();
    logs.push({
      id: uuid(100 + logs.length), calendarId: PATTERN_CALENDAR_ID, itemDefinitionId: items[itemIndex]!.id, loggedAt,
      intensity: itemIndex % 2 === 1 ? 2 : null, durationMinutes: null, notes, createdAt: loggedAt, updatedAt: loggedAt,
    });
  };
  for (const day of WATCH_DAYS) {
    log(0, day, '08:00');
    log(1, day, '09:00', 'Después de comer');
  }
  for (const day of DETECTED_DAYS) {
    log(2, day, '08:00');
    log(3, day, '09:00');
  }
  log(1, UNMARKED_DAY, '09:00');

  return {
    version: 1,
    profiles: [{
      id: PATTERN_CALENDAR_ID, name: 'Luna', profileType: 'Mascota', avatarIcon: '🐱', colorTheme: 'slate',
      correlationWindowHours: 2, createdAt,
    }],
    items,
    logs,
  };
}
