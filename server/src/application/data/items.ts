import { archiveItem, createItemDefinition, DomainRuleError, editItem, restoreItem } from '@cuidat/shared';
import type { HealthItemDefinition, ItemCreateBody, ItemPatchBody, ItemStatus } from '@cuidat/shared';
import { NotFoundError } from '../../domain/errors.js';
import type { CalendarScope } from '../../domain/ports.js';
import type { DataDependencies } from './dataDependencies.js';

// Catalog lifecycle (TECH_SPEC.md use case 9, ADR-006). The rules are the pure functions of
// shared/src/catalog.ts; the repository runs them on the locked lineage and writes the difference.
// Routes address a lineage by its root id (the id of the first version).

function lineageNotFound(): DomainRuleError {
  return new DomainRuleError('ITEM_NOT_FOUND', 'El ítem no existe.');
}

export async function listItems(deps: DataDependencies, scope: CalendarScope, status?: ItemStatus): Promise<HealthItemDefinition[]> {
  if (!(await deps.profiles.find(scope.userId, scope.calendarId))) {
    throw new NotFoundError('El calendario no existe.');
  }
  return deps.items.list(scope, status);
}

export async function createItem(deps: DataDependencies, scope: CalendarScope, body: ItemCreateBody): Promise<HealthItemDefinition> {
  const item = createItemDefinition(scope.calendarId, body, deps.newId(), deps.clock().toISOString());
  if (!(await deps.items.insert(scope, [item]))) {
    throw new NotFoundError('El calendario no existe.');
  }
  return item;
}

async function changeLineage(
  deps: DataDependencies,
  scope: CalendarScope,
  rootId: string,
  change: (lineage: HealthItemDefinition[]) => HealthItemDefinition[],
): Promise<HealthItemDefinition[]> {
  const lineage = await deps.items.updateLineage(scope, rootId, change);
  if (!lineage) {
    throw lineageNotFound();
  }
  return lineage;
}

/**
 * Name and emoji: in place on the whole lineage. Tracking flags: the live version is superseded and
 * a new one is inserted after it (the unique live-version index and the triggers require that order).
 */
export function editItemLineage(deps: DataDependencies, scope: CalendarScope, rootId: string, body: ItemPatchBody): Promise<HealthItemDefinition[]> {
  return changeLineage(deps, scope, rootId, (lineage) =>
    editItem(lineage, rootId, body, { newId: deps.newId(), now: deps.clock().toISOString() }),
  );
}

export function archiveItemLineage(deps: DataDependencies, scope: CalendarScope, rootId: string): Promise<HealthItemDefinition[]> {
  return changeLineage(deps, scope, rootId, (lineage) => archiveItem(lineage, rootId));
}

export function restoreItemLineage(deps: DataDependencies, scope: CalendarScope, rootId: string): Promise<HealthItemDefinition[]> {
  return changeLineage(deps, scope, rootId, (lineage) => restoreItem(lineage, rootId));
}

/** How many logs a permanent deletion would erase (shown before the user accepts). */
export async function getDeleteImpact(deps: DataDependencies, scope: CalendarScope, rootId: string): Promise<number> {
  const logs = await deps.items.countLineageLogs(scope, rootId);
  if (logs === null) {
    throw lineageNotFound();
  }
  return logs;
}

/** Permanent deletion of the lineage and its logs. Idempotent: a missing lineage is not an error. */
export async function deleteItemLineage(deps: DataDependencies, scope: CalendarScope, rootId: string): Promise<void> {
  await deps.items.removeLineage(scope, rootId);
}
