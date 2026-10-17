import {
  DomainRuleError,
  GUEST_MAX_SYMPTOMS,
  GUEST_MAX_TRIGGERS,
  validateEventLogFields,
} from '@cuidat/shared';
import type { GuestData, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import { ValidationError } from '../../domain/errors.js';
import type { GuestImport } from '../../domain/ports.js';

type GuestItem = GuestData['items'][number];

function liveCount(items: readonly GuestItem[], symptoms: boolean): number {
  return items.filter((item) => item.status !== 'superseded' && (item.category === 'symptom') === symptoms).length;
}

/**
 * Orders the lineage so that every parent is placed before its children.
 * Each item is checked against the rules of TECH_SPEC.md section 1 (lineage, one live version).
 */
function orderLineage(items: readonly GuestItem[]): GuestItem[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  if (byId.size !== items.length) {
    throw new ValidationError('Hay ítems duplicados en los datos del invitado.');
  }
  const placed = new Set<string>();
  const ordered: GuestItem[] = [];
  let pending = [...items];
  while (pending.length > 0) {
    const ready = pending.filter((item) => {
      if (item.parentId === null) {
        return item.rootId === item.id;
      }
      const parent = byId.get(item.parentId);
      return placed.has(item.parentId) && parent !== undefined && parent.rootId === item.rootId;
    });
    if (ready.length === 0) {
      throw new ValidationError('El linaje de los ítems del invitado no es válido.');
    }
    for (const item of ready) {
      placed.add(item.id);
      ordered.push(item);
    }
    pending = pending.filter((item) => !placed.has(item.id));
  }

  const liveByRoot = new Map<string, number>();
  for (const item of ordered) {
    if (item.status !== 'superseded') {
      liveByRoot.set(item.rootId, (liveByRoot.get(item.rootId) ?? 0) + 1);
    }
  }
  for (const item of ordered) {
    if (liveByRoot.get(item.rootId) !== 1) {
      throw new ValidationError('Cada ítem del invitado debe tener exactamente una versión vigente.');
    }
  }
  return ordered;
}

/**
 * Validates the guest document with the normal rules (one profile, 3 symptoms and 3
 * triggers/medication, no future events, plain text) and remaps every id to a new one.
 * Returns `null` when the guest has no calendar. Nothing is written here.
 */
export function planGuestImport(data: GuestData, now: Date, newId: () => string): GuestImport | null {
  if (data.profiles.length === 0) {
    if (data.items.length > 0 || data.logs.length > 0) {
      throw new ValidationError('Los datos del invitado no tienen calendario.');
    }
    return null;
  }
  const [guestProfile] = data.profiles;
  if (!guestProfile) {
    return null;
  }
  if (liveCount(data.items, true) > GUEST_MAX_SYMPTOMS || liveCount(data.items, false) > GUEST_MAX_TRIGGERS) {
    throw new DomainRuleError('GUEST_LIMIT', 'El invitado supera el límite de ítems.');
  }
  if (data.items.some((item) => item.calendarId !== guestProfile.id)) {
    throw new ValidationError('Hay ítems de otro calendario en los datos del invitado.');
  }
  if (data.logs.some((log) => log.calendarId !== guestProfile.id)) {
    throw new ValidationError('Hay registros de otro calendario en los datos del invitado.');
  }

  const profileId = newId();
  const itemIds = new Map<string, string>();
  const ordered = orderLineage(data.items);
  const items: HealthItemDefinition[] = ordered.map((item) => {
    const id = newId();
    itemIds.set(item.id, id);
    return {
      id,
      calendarId: profileId,
      rootId: itemIds.get(item.rootId) ?? id,
      parentId: item.parentId === null ? null : (itemIds.get(item.parentId) ?? null),
      name: item.name,
      emoji: item.emoji,
      category: item.category,
      trackIntensity: item.trackIntensity,
      trackDuration: item.trackDuration,
      status: item.status,
      createdAt: item.createdAt,
    };
  });

  const guestItemById = new Map(data.items.map((item) => [item.id, item]));
  const logIds = new Set<string>();
  const logs: HealthEventLog[] = data.logs.map((log) => {
    const item = guestItemById.get(log.itemDefinitionId);
    if (!item || logIds.has(log.id)) {
      throw new ValidationError('Un registro del invitado no corresponde a ningún ítem o está duplicado.');
    }
    logIds.add(log.id);
    // Stored logs are not "new": archived and superseded items keep their history (ADR-007).
    const fields = validateEventLogFields(
      item,
      {
        loggedAt: log.loggedAt,
        intensity: log.intensity,
        durationMinutes: log.durationMinutes,
        notes: log.notes,
      },
      { isNew: false, now },
    );
    return {
      id: newId(),
      calendarId: profileId,
      itemDefinitionId: itemIds.get(log.itemDefinitionId) ?? '',
      ...fields,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  });

  return {
    profile: {
      id: profileId,
      name: guestProfile.name,
      profileType: guestProfile.profileType,
      avatarIcon: guestProfile.avatarIcon,
      colorTheme: guestProfile.colorTheme,
      correlationWindowHours: guestProfile.correlationWindowHours,
      createdAt: guestProfile.createdAt,
    },
    items,
    logs,
  };
}
