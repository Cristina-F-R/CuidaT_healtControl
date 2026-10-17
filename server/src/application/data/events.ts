import { FUTURE_TOLERANCE_MINUTES, validateEventLogFields } from '@cuidat/shared';
import type { EventUpsertBody, HealthEventLog } from '@cuidat/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type { CalendarScope } from '../../domain/ports.js';
import type { DataDependencies } from './dataDependencies.js';

/** Initial load: the last three months (TECH_SPEC.md use case 9, temporal pagination). */
const DEFAULT_RANGE_MONTHS = 3;

export interface EventRangeInput {
  from?: string;
  to?: string;
}

function defaultFrom(now: Date): Date {
  const from = new Date(now);
  from.setUTCMonth(from.getUTCMonth() - DEFAULT_RANGE_MONTHS);
  return from;
}

export async function listEvents(deps: DataDependencies, scope: CalendarScope, input: EventRangeInput): Promise<HealthEventLog[]> {
  if (!(await deps.profiles.find(scope.userId, scope.calendarId))) {
    throw new NotFoundError('El calendario no existe.');
  }
  const now = deps.clock();
  const to = input.to ? new Date(input.to) : new Date(now.getTime() + FUTURE_TOLERANCE_MINUTES * 60_000);
  const from = input.from ? new Date(input.from) : defaultFrom(now);
  if (from > to) {
    throw new ValidationError('El inicio del rango no puede ser posterior al final.');
  }
  return deps.events.list(scope, { from, to });
}

/**
 * Idempotent upsert by the client-generated id (ADR-007): last write wins on `updated_at`, which
 * the server clamps to now() + 5 min so a wrong clock cannot win every future conflict.
 */
export async function upsertEvent(deps: DataDependencies, scope: CalendarScope, logId: string, body: EventUpsertBody): Promise<HealthEventLog> {
  if (!(await deps.profiles.find(scope.userId, scope.calendarId))) {
    throw new NotFoundError('El calendario no existe.');
  }
  const now = deps.clock();
  const latest = now.getTime() + FUTURE_TOLERANCE_MINUTES * 60_000;
  const updatedAt = new Date(Math.min(Date.parse(body.updatedAt), latest)).toISOString();
  const candidate: HealthEventLog = {
    id: logId,
    calendarId: scope.calendarId,
    itemDefinitionId: body.itemDefinitionId,
    loggedAt: body.loggedAt,
    intensity: body.intensity,
    durationMinutes: body.durationMinutes,
    notes: body.notes,
    createdAt: body.createdAt,
    updatedAt,
  };

  const outcome = await deps.events.upsert(scope, candidate, (item, existing) => {
    if (existing && existing.itemDefinitionId !== candidate.itemDefinitionId) {
      throw new ValidationError('Un registro no puede cambiar de ítem.');
    }
    // Synced logs are accepted even if their item was archived or superseded meanwhile (ADR-007).
    const isNew = existing === null && !body.deferred;
    return { ...candidate, ...validateEventLogFields(item, candidate, { isNew, now }) };
  });

  switch (outcome.kind) {
    case 'saved':
    case 'stale':
      return outcome.log;
    case 'conflict':
      throw new ConflictError('El identificador del registro ya está en uso.', 'EVENT_ID_CONFLICT');
    case 'item_not_found':
      throw new NotFoundError('El ítem del registro no existe en este calendario.');
  }
}

/** Idempotent: deleting a log that is already gone answers the same. */
export async function deleteEvent(deps: DataDependencies, scope: CalendarScope, logId: string): Promise<void> {
  await deps.events.remove(scope, logId);
}
