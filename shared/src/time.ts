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

// Local calendar days in a given IANA time zone, with the built-in Intl API (this package has no date
// library). Reports group logs by the user's local day (TECH_SPEC.md section 9.1 / Phase 4.6).

const zoneFormatters = new Map<string, Intl.DateTimeFormat>();

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = zoneFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    zoneFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** True for a time zone the runtime knows (for example `Europe/Madrid`). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    zoneFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

interface ZonedFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedFields(instant: number, timeZone: string): ZonedFields {
  const parts: Record<string, number> = {};
  for (const part of zoneFormatter(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    year: parts['year']!,
    month: parts['month']!,
    day: parts['day']!,
    hour: parts['hour']!,
    minute: parts['minute']!,
    second: parts['second']!,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local day (`YYYY-MM-DD`) and time (`HH:mm`) of an instant in a time zone. */
export function zonedDateTime(instant: string | number, timeZone: string): { date: string; time: string } {
  const fields = zonedFields(typeof instant === 'number' ? instant : Date.parse(instant), timeZone);
  return { date: `${fields.year}-${pad(fields.month)}-${pad(fields.day)}`, time: `${pad(fields.hour)}:${pad(fields.minute)}` };
}

/** Milliseconds the time zone is ahead of UTC at that instant. */
function zoneOffset(instant: number, timeZone: string): number {
  const fields = zonedFields(instant, timeZone);
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  return asUtc - (instant - (instant % 1000));
}

/** First instant (epoch ms) of a local day (`YYYY-MM-DD`) in a time zone, DST changes included. */
export function startOfZonedDay(date: string, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const utcMidnight = Date.UTC(year, month - 1, day);
  // The offset at the guess may differ from the one at the real local midnight (DST): correct once.
  const guess = utcMidnight - zoneOffset(utcMidnight, timeZone);
  return utcMidnight - zoneOffset(guess, timeZone);
}

/** Months (`YYYY-MM`) from the month of `from` to the month of `to`, both included. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = to.split('-').map(Number) as [number, number];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(`${year}-${pad(month)}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
