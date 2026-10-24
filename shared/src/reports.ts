import { REPORT_SCHEMA_VERSION } from './constants.js';
import { detectCorrelations, markPatternDays } from './correlation.js';
import { DomainRuleError } from './errors.js';
import type { ReportDay, ReportItem, ReportItemStats, ReportLog, ReportSnapshot } from './schemas.js';
import { monthsBetween, startOfZonedDay, zonedDateTime } from './time.js';
import type { CalendarProfile, HealthEvent, HealthEventLog, HealthItemDefinition } from './types.js';

// Saved reports (TECH_SPEC.md section 9.1, ADR-022): the server builds an immutable snapshot with the
// same engine as the app. Pure and deterministic: everything it needs comes in the input.

const MS_PER_HOUR = 3_600_000;

export interface ReportInput {
  profile: CalendarProfile;
  /** Every version of every lineage of the calendar. */
  items: readonly HealthItemDefinition[];
  /** Logs from one correlation window before the period to its end (more is ignored). */
  logs: readonly HealthEventLog[];
  /** Local days (`YYYY-MM-DD`) in `timeZone`, both included. */
  from: string;
  to: string;
  timeZone: string;
  symptomRootIds: readonly string[];
  triggerRootIds: readonly string[];
  generatedAt: string;
}

/** First local instant after the period, to bound the logs a caller must load. */
export function reportRange(from: string, to: string, timeZone: string, windowHours: number): { from: Date; to: Date } {
  const lastDay = new Date(`${to}T00:00:00.000Z`);
  lastDay.setUTCDate(lastDay.getUTCDate() + 1);
  return {
    from: new Date(startOfZonedDay(from, timeZone) - windowHours * MS_PER_HOUR),
    to: new Date(startOfZonedDay(lastDay.toISOString().slice(0, 10), timeZone) - 1),
  };
}

/** One entry per selected lineage, through its live version (name and emoji are lineage-wide). */
function selectedLineages(input: ReportInput): ReportItem[] {
  const lineages = new Map<string, HealthItemDefinition>();
  for (const item of input.items) {
    const known = lineages.get(item.rootId);
    if (!known || known.status === 'superseded') {
      lineages.set(item.rootId, item);
    }
  }
  const pick = (rootIds: readonly string[], symptoms: boolean): ReportItem[] =>
    [...new Set(rootIds)].map((rootId) => {
      const item = lineages.get(rootId);
      if (!item || (item.category === 'symptom') !== symptoms) {
        throw new DomainRuleError('INVALID_INPUT', 'La selección incluye un ítem que no pertenece a este calendario.');
      }
      return { rootId, name: item.name, emoji: item.emoji, category: item.category, archived: item.status === 'archived' };
    });
  return [...pick(input.symptomRootIds, true), ...pick(input.triggerRootIds, false)];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function statsOf(rootId: string, logs: readonly ReportLog[]): ReportItemStats {
  const own = logs.filter((log) => log.rootId === rootId);
  const intensities = own.flatMap((log) => (log.intensity === null ? [] : [log.intensity]));
  const durations = own.flatMap((log) => (log.durationMinutes === null ? [] : [log.durationMinutes]));
  const total = durations.reduce((sum, minutes) => sum + minutes, 0);
  return {
    rootId,
    logCount: own.length,
    intensityCounts: intensities.length === 0 ? null : [1, 2, 3].map((level) => intensities.filter((value) => value === level).length) as [number, number, number],
    intensityMean: intensities.length === 0 ? null : round(intensities.reduce((sum, value) => sum + value, 0) / intensities.length),
    durationTotalMinutes: durations.length === 0 ? null : total,
    durationMeanMinutes: durations.length === 0 ? null : round(total / durations.length),
  };
}

/**
 * Snapshot of one calendar over a period, restricted to the selected lineages: calendar data,
 * patterns (with the calendar's window and the consultation-mode day marks), statistics per item and
 * the day-by-day logs. Throws DomainRuleError when the selection does not belong to the calendar.
 */
export function buildReportSnapshot(input: ReportInput): ReportSnapshot {
  const { profile, timeZone, from, to } = input;
  const items = selectedLineages(input);
  const selected = new Set(items.map((item) => item.rootId));
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const triggersFrom = startOfZonedDay(from, timeZone) - profile.correlationWindowHours * MS_PER_HOUR;

  const events: HealthEvent[] = [];
  const dayOf = new Map<string, string>();
  const dayLogs = new Map<string, ReportLog[]>();
  // Stable order of the logs (section 6): loggedAt, then createdAt, then id.
  const ordered = [...input.logs].sort(
    (a, b) => Date.parse(a.loggedAt) - Date.parse(b.loggedAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
  );
  for (const log of ordered) {
    const item = itemById.get(log.itemDefinitionId);
    if (!item || !selected.has(item.rootId)) {
      continue;
    }
    const local = zonedDateTime(log.loggedAt, timeZone);
    const inPeriod = local.date >= from && local.date <= to;
    const isSymptom = item.category === 'symptom';
    // Symptoms count inside the period; triggers may come up to one window earlier (section 6).
    if (inPeriod || (!isSymptom && Date.parse(log.loggedAt) >= triggersFrom && local.date <= to)) {
      events.push({ id: log.id, itemDefinitionId: item.id, rootItemId: item.rootId, category: item.category, loggedAt: log.loggedAt, createdAt: log.createdAt });
      dayOf.set(log.id, local.date);
    }
    if (inPeriod) {
      const entries = dayLogs.get(local.date) ?? [];
      entries.push({
        time: local.time,
        rootId: item.rootId,
        intensity: item.trackIntensity ? log.intensity : null,
        durationMinutes: item.trackDuration ? log.durationMinutes : null,
        notes: log.notes,
      });
      dayLogs.set(local.date, entries);
    }
  }

  const thresholds = detectCorrelations(events, profile.correlationWindowHours);
  const marks = markPatternDays(thresholds, (eventId) => dayOf.get(eventId));
  // The logs were visited in time order, so the days already come out in date order.
  const days: ReportDay[] = [...dayLogs.entries()].map(([date, logs]) => ({ date, mark: marks.get(date) ?? null, logs }));
  const allLogs = days.flatMap((day) => day.logs);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    timeZone,
    calendar: {
      name: profile.name,
      profileType: profile.profileType,
      avatarIcon: profile.avatarIcon,
      colorTheme: profile.colorTheme,
      correlationWindowHours: profile.correlationWindowHours,
    },
    period: { from, to },
    items,
    patterns: thresholds
      .map(({ triggerRootId, symptomRootId, occurrences, category }) => ({ triggerRootId, symptomRootId, occurrences, category }))
      .sort((a, b) => (a.category === b.category ? b.occurrences - a.occurrences : a.category === 'Patrón detectado' ? -1 : 1)),
    itemStats: items.map((item) => statsOf(item.rootId, allLogs)),
    days,
    months: monthsBetween(from, to),
  };
}
