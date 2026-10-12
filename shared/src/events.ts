import { isBeyondAllowedFuture } from './time.js';
import { DomainRuleError } from './errors.js';
import { NOTES_MAX_LENGTH } from './constants.js';
import type { HealthItemDefinition, Intensity } from './types.js';

export const DURATION_MIN_MINUTES = 1;
export const DURATION_MAX_MINUTES = 1440;

export interface EventLogFields {
  /** ISO 8601 UTC instant (ADR-016). */
  loggedAt: string;
  intensity: Intensity | null;
  durationMinutes: number | null;
  notes: string | null;
}

export interface EventLogRules {
  /** New logs cannot be attached to archived items; existing logs can still be edited. */
  isNew: boolean;
  now: Date;
}

const INTENSITIES: readonly Intensity[] = [1, 2, 3];

/**
 * Checks one log against the version of the item it belongs to (TECH_SPEC.md use cases 1, 8 and 9).
 * Metrics are accepted only when that version records them. Notes must already be sanitized by the client.
 */
export function validateEventLogFields(
  item: HealthItemDefinition,
  fields: EventLogFields,
  rules: EventLogRules,
): EventLogFields {
  if (rules.isNew && item.status !== 'active') {
    throw new DomainRuleError('ITEM_NOT_ACTIVE', 'Un ítem archivado no admite registros nuevos.');
  }
  if (Number.isNaN(Date.parse(fields.loggedAt))) {
    throw new DomainRuleError('INVALID_INPUT', 'La fecha del registro no es válida.');
  }
  if (isBeyondAllowedFuture(fields.loggedAt, rules.now)) {
    throw new DomainRuleError('FUTURE_DATE', 'No se pueden registrar métricas en fechas futuras.');
  }

  if (fields.intensity !== null) {
    if (!item.trackIntensity) {
      throw new DomainRuleError('INVALID_INPUT', 'Este ítem no registra intensidad.');
    }
    if (!INTENSITIES.includes(fields.intensity)) {
      throw new DomainRuleError('INVALID_INPUT', 'La intensidad debe ser 1, 2 o 3.');
    }
  }

  if (fields.durationMinutes !== null) {
    if (!item.trackDuration) {
      throw new DomainRuleError('INVALID_INPUT', 'Este ítem no registra duración.');
    }
    const minutes = fields.durationMinutes;
    if (!Number.isInteger(minutes) || minutes < DURATION_MIN_MINUTES || minutes > DURATION_MAX_MINUTES) {
      throw new DomainRuleError('INVALID_INPUT', `La duración debe estar entre ${DURATION_MIN_MINUTES} y ${DURATION_MAX_MINUTES} minutos.`);
    }
  }

  const notes = fields.notes?.trim() ?? '';
  if ([...notes].length > NOTES_MAX_LENGTH) {
    throw new DomainRuleError('INVALID_INPUT', `Las notas no pueden superar ${NOTES_MAX_LENGTH} caracteres.`);
  }

  return { ...fields, notes: notes === '' ? null : notes };
}
