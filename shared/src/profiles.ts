import { CORRELATION_WINDOWS, DEFAULT_CORRELATION_WINDOW_HOURS, DEFAULT_PROFILE_COLOR_THEME, PROFILE_COLOR_THEMES } from './constants.js';
import { DomainRuleError } from './errors.js';
import type { CalendarProfile, CorrelationWindowHours, ProfileColorTheme } from './types.js';
import { requireText } from './validation.js';

export const PROFILE_NAME_MAX_LENGTH = 100;
export const PROFILE_TYPE_MAX_LENGTH = 50;

export interface ProfileDraft {
  name: string;
  profileType: string;
  avatarIcon?: string;
  colorTheme?: ProfileColorTheme;
  correlationWindowHours?: CorrelationWindowHours;
}

/** Builds a calendar profile; the correlation window (ADR-001) and the color theme must be allowed values. */
export function createCalendarProfile(draft: ProfileDraft, id: string, createdAt: string): CalendarProfile {
  const windowHours = draft.correlationWindowHours ?? DEFAULT_CORRELATION_WINDOW_HOURS;
  if (!CORRELATION_WINDOWS.includes(windowHours)) {
    throw new DomainRuleError('INVALID_INPUT', 'La ventana de correlación no es válida.');
  }
  const colorTheme = draft.colorTheme ?? DEFAULT_PROFILE_COLOR_THEME;
  if (!(PROFILE_COLOR_THEMES as readonly string[]).includes(colorTheme)) {
    throw new DomainRuleError('INVALID_INPUT', 'El color del calendario no es válido.');
  }
  return {
    id,
    name: requireText(draft.name, 'El nombre', PROFILE_NAME_MAX_LENGTH),
    profileType: requireText(draft.profileType, 'El tipo', PROFILE_TYPE_MAX_LENGTH),
    avatarIcon: draft.avatarIcon ?? '👤',
    colorTheme,
    correlationWindowHours: windowHours,
    createdAt,
  };
}
