import { GUEST_MAX_SYMPTOMS, GUEST_MAX_TRIGGERS, GUEST_MAX_PROFILES } from './constants.js';
import type { CalendarProfile, HealthItemDefinition, ItemCategory } from './types.js';

// Freemium soft limits (TECH_SPEC.md use case 4, ADR-018). They are client-side incentives only.

/**
 * True when a guest cannot add one more item of this category. Each lineage counts once through its
 * live version: archived items still take a slot, permanently deleted ones free it.
 */
export function isGuestItemLimitReached(
  items: readonly HealthItemDefinition[],
  calendarId: string,
  category: ItemCategory,
): boolean {
  const isSymptom = category === 'symptom';
  const limit = isSymptom ? GUEST_MAX_SYMPTOMS : GUEST_MAX_TRIGGERS;
  const used = items.filter(
    (item) =>
      item.calendarId === calendarId &&
      item.status !== 'superseded' &&
      (item.category === 'symptom') === isSymptom,
  ).length;
  return used >= limit;
}

export function isGuestProfileLimitReached(profiles: readonly CalendarProfile[]): boolean {
  return profiles.length >= GUEST_MAX_PROFILES;
}
