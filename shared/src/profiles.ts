import { CORRELATION_WINDOWS, DEFAULT_CORRELATION_WINDOW_HOURS } from './constants.js';
import { DomainRuleError } from './errors.js';
import type { CalendarProfile, CorrelationWindowHours } from './types.js';
import { requireText } from './validation.js';

export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_TYPE_MAX_LENGTH = 50;

export interface ProfileDraft {
  name: string;
  profileType: string;
  avatarIcon?: string;
  colorTheme?: string;
  correlationWindowHours?: CorrelationWindowHours;
}

/** Builds a calendar profile; the correlation window must be one of the allowed values (ADR-001). */
export function createCalendarProfile(draft: ProfileDraft, id: string, createdAt: string): CalendarProfile {
  const windowHours = draft.correlationWindowHours ?? DEFAULT_CORRELATION_WINDOW_HOURS;
  if (!CORRELATION_WINDOWS.includes(windowHours)) {
    throw new DomainRuleError('INVALID_INPUT', 'La ventana de correlación no es válida.');
  }
  return {
    id,
    name: requireText(draft.name, 'El nombre', PROFILE_NAME_MAX_LENGTH),
    profileType: requireText(draft.profileType, 'El tipo', PROFILE_TYPE_MAX_LENGTH),
    avatarIcon: draft.avatarIcon ?? '👤',
    colorTheme: draft.colorTheme ?? 'slate',
    correlationWindowHours: windowHours,
    createdAt,
  };
}
