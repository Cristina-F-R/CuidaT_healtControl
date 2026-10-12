import { FUTURE_TOLERANCE_MINUTES } from './constants.js';

export interface DayPartPreset {
  label: string;
  hour: number;
  minute: number;
}

/** Default times offered by the event modal when the day is not today (ADR-016). */
export const DAY_PART_PRESETS: readonly DayPartPreset[] = [
  { label: 'Mañana', hour: 8, minute: 0 },
  { label: 'Mediodía', hour: 13, minute: 0 },
  { label: 'Tarde', hour: 18, minute: 0 },
  { label: 'Noche', hour: 22, minute: 0 },
];

/**
 * Server-side future rule (TECH_SPEC.md use case 8): an instant is not allowed when it is
 * later than `now` plus the clock-skew tolerance. Unparseable values are never allowed.
 */
export function isBeyondAllowedFuture(
  loggedAt: string | Date,
  now: Date = new Date(),
  toleranceMinutes: number = FUTURE_TOLERANCE_MINUTES,
): boolean {
  const instant = loggedAt instanceof Date ? loggedAt.getTime() : Date.parse(loggedAt);
  if (Number.isNaN(instant)) {
    return true;
  }
  return instant > now.getTime() + toleranceMinutes * 60_000;
}
