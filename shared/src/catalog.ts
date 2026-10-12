import { DomainRuleError } from './errors.js';
import { requireText } from './validation.js';
import type { HealthEventLog, HealthItemDefinition, ItemCategory, ItemStatus } from './types.js';

// Catalog lifecycle rules (TECH_SPEC.md use case 9, ADR-006). Every function is pure:
// it returns a new array and keeps the references of the rows it does not touch.

export const ITEM_NAME_MAX_LENGTH = 100;
export const ITEM_EMOJI_MAX_LENGTH = 10;

export interface ItemDraft {
  name: string;
  emoji: string;
  category: ItemCategory;
  trackIntensity: boolean;
  trackDuration: boolean;
}

export interface ItemEditPatch {
  name?: string;
  emoji?: string;
  /** Accepted only when it equals the current category: the category is locked (ADR-006). */
  category?: ItemCategory;
  trackIntensity?: boolean;
  trackDuration?: boolean;
}

export interface ItemEditOptions {
  /** Id of the new version, used only when the tracking shape changes. */
  newId: string;
  /** ISO 8601 UTC instant of the new version. */
  now: string;
}

export interface CatalogSnapshot {
  items: HealthItemDefinition[];
  logs: HealthEventLog[];
}

export function createItemDefinition(
  calendarId: string,
  draft: ItemDraft,
  id: string,
  createdAt: string,
): HealthItemDefinition {
  return {
    id,
    calendarId,
    rootId: id,
    parentId: null,
    name: requireText(draft.name, 'El nombre', ITEM_NAME_MAX_LENGTH),
    emoji: requireText(draft.emoji, 'El emoji', ITEM_EMOJI_MAX_LENGTH),
    category: draft.category,
    trackIntensity: draft.trackIntensity,
    trackDuration: draft.trackDuration,
    status: 'active',
    createdAt,
  };
}

export function getLineage(items: readonly HealthItemDefinition[], rootId: string): HealthItemDefinition[] {
  return items.filter((item) => item.rootId === rootId);
}

/** The single version of a lineage that is not superseded (active or archived). */
export function getLiveVersion(items: readonly HealthItemDefinition[], rootId: string): HealthItemDefinition {
  const live = items.find((item) => item.rootId === rootId && item.status !== 'superseded');
  if (!live) {
    throw new DomainRuleError('ITEM_NOT_FOUND', 'El ítem no existe.');
  }
  return live;
}

/**
 * Edits an item lineage:
 * - `name` / `emoji`: in place on every version of the lineage (retroactive).
 * - `trackIntensity` / `trackDuration`: the live version becomes `superseded` and a new `active`
 *   version continues the lineage. Existing logs stay attached to the old version.
 * - `category`: locked, any different value is rejected.
 * - Archived items are read-only.
 */
export function editItem(
  items: readonly HealthItemDefinition[],
  rootId: string,
  patch: ItemEditPatch,
  options: ItemEditOptions,
): HealthItemDefinition[] {
  const live = getLiveVersion(items, rootId);
  if (live.status === 'archived') {
    throw new DomainRuleError('ITEM_ARCHIVED', 'Un ítem archivado no se puede editar. Restáuralo primero.');
  }
  if (patch.category !== undefined && patch.category !== live.category) {
    throw new DomainRuleError('CATEGORY_LOCKED', 'La categoría no se puede cambiar. Crea un ítem nuevo.');
  }

  const name = patch.name === undefined ? live.name : requireText(patch.name, 'El nombre', ITEM_NAME_MAX_LENGTH);
  const emoji = patch.emoji === undefined ? live.emoji : requireText(patch.emoji, 'El emoji', ITEM_EMOJI_MAX_LENGTH);
  const trackIntensity = patch.trackIntensity ?? live.trackIntensity;
  const trackDuration = patch.trackDuration ?? live.trackDuration;

  const cosmeticChanged = name !== live.name || emoji !== live.emoji;
  const shapeChanged = trackIntensity !== live.trackIntensity || trackDuration !== live.trackDuration;
  if (!cosmeticChanged && !shapeChanged) {
    return [...items];
  }

  const renamed = cosmeticChanged
    ? items.map((item) => (item.rootId === rootId ? { ...item, name, emoji } : item))
    : [...items];
  if (!shapeChanged) {
    return renamed;
  }

  const superseded = renamed.map((item) => (item.id === live.id ? { ...item, status: 'superseded' as const } : item));
  const nextVersion: HealthItemDefinition = {
    ...live,
    id: options.newId,
    parentId: live.id,
    name,
    emoji,
    trackIntensity,
    trackDuration,
    status: 'active',
    createdAt: options.now,
  };
  return [...superseded, nextVersion];
}

function setLiveStatus(
  items: readonly HealthItemDefinition[],
  rootId: string,
  from: ItemStatus,
  to: ItemStatus,
  message: string,
): HealthItemDefinition[] {
  const live = getLiveVersion(items, rootId);
  if (live.status !== from) {
    throw new DomainRuleError(from === 'active' ? 'ITEM_NOT_ACTIVE' : 'ITEM_NOT_ARCHIVED', message);
  }
  return items.map((item) => (item.id === live.id ? { ...item, status: to } : item));
}

/** Archive: reversible, hidden from the dock, logs stay visible and counted in analytics. */
export function archiveItem(items: readonly HealthItemDefinition[], rootId: string): HealthItemDefinition[] {
  return setLiveStatus(items, rootId, 'active', 'archived', 'Solo se puede archivar un ítem activo.');
}

export function restoreItem(items: readonly HealthItemDefinition[], rootId: string): HealthItemDefinition[] {
  return setLiveStatus(items, rootId, 'archived', 'active', 'Solo se puede restaurar un ítem archivado.');
}

/** Number of logs that a permanent deletion of the lineage would erase. */
export function countLineageLogs(
  items: readonly HealthItemDefinition[],
  logs: readonly HealthEventLog[],
  rootId: string,
): number {
  const versionIds = new Set(getLineage(items, rootId).map((item) => item.id));
  return logs.filter((log) => versionIds.has(log.itemDefinitionId)).length;
}

/** Permanent delete: every version of the lineage and, by cascade, all of their logs. */
export function removeLineage(
  items: readonly HealthItemDefinition[],
  logs: readonly HealthEventLog[],
  rootId: string,
): CatalogSnapshot {
  const versionIds = new Set(getLineage(items, rootId).map((item) => item.id));
  return {
    items: items.filter((item) => item.rootId !== rootId),
    logs: logs.filter((log) => !versionIds.has(log.itemDefinitionId)),
  };
}
