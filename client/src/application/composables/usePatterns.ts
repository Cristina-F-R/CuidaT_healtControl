import { detectCorrelations } from '@cuidat/shared';
import type { CorrelationWindowHours, HealthEvent, PatternCategory } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { DAY_KEY_FORMAT, useCalendar } from './useCalendar';
import { useViewMode } from './useViewMode';

const MS_PER_HOUR = 3_600_000;

export interface PatternView {
  key: string;
  triggerLabel: string;
  symptomLabel: string;
  occurrences: number;
  category: PatternCategory;
  /** Symptom logs that make up the pattern (consultation day marks). */
  symptomEventIds: string[];
}

/** Mark of a calendar day in consultation mode (TECH_SPEC.md use case 12). */
export type DayMark = 'watch' | 'detected';

/** What to correlate: symptoms inside [from, to] (epoch ms), optionally limited to some lineages. */
export interface PatternQuery {
  from: number;
  to: number;
  windowHours: CorrelationWindowHours;
  /** Lineages (`root_id`) to keep; `undefined` keeps all. */
  symptomRoots?: ReadonlySet<string>;
  triggerRoots?: ReadonlySet<string>;
}

/**
 * Correlations of a period (TECH_SPEC.md section 6). Symptoms are counted inside the period;
 * triggers may come up to one correlation window earlier, so a symptom at the start of the period
 * still finds its trigger. Reads the stores, so call it inside a `computed`.
 */
export function collectPatterns(query: PatternQuery): PatternView[] {
  const eventStore = useEventStore();
  const itemStore = useItemDefinitionStore();
  const triggerFrom = query.from - query.windowHours * MS_PER_HOUR;

  function labelOf(rootId: string): string {
    const live = itemStore.findLiveByRoot(rootId);
    return live ? `${live.emoji} ${live.name}` : 'Ítem eliminado';
  }

  const events: HealthEvent[] = [];
  for (const log of eventStore.logs) {
    const item = itemStore.findById(log.itemDefinitionId);
    if (!item) {
      continue;
    }
    const isSymptom = item.category === 'symptom';
    const roots = isSymptom ? query.symptomRoots : query.triggerRoots;
    if (roots && !roots.has(item.rootId)) {
      continue;
    }
    const instant = Date.parse(log.loggedAt);
    if (instant > query.to || instant < (isSymptom ? query.from : triggerFrom)) {
      continue;
    }
    events.push({
      id: log.id,
      itemDefinitionId: item.id,
      rootItemId: item.rootId,
      category: item.category,
      loggedAt: log.loggedAt,
      createdAt: log.createdAt,
    });
  }

  return detectCorrelations(events, query.windowHours).map((pattern) => ({
    key: `${pattern.triggerRootId}|${pattern.symptomRootId}`,
    triggerLabel: labelOf(pattern.triggerRootId),
    symptomLabel: labelOf(pattern.symptomRootId),
    occurrences: pattern.occurrences,
    category: pattern.category,
    symptomEventIds: pattern.symptomEventIds,
  }));
}

/** Splits patterns by threshold for the two sections of the UI. */
export function splitByCategory(patterns: readonly PatternView[]): { watch: PatternView[]; detected: PatternView[] } {
  return {
    watch: patterns.filter((pattern) => pattern.category === 'Vigilar posible patrón'),
    detected: patterns.filter((pattern) => pattern.category === 'Patrón detectado'),
  };
}

/** One month: its symptoms and, through the window, the triggers logged just before it. */
export function monthPatternQuery(monthKey: string, windowHours: CorrelationWindowHours): PatternQuery {
  const monthStart = dayjs(`${monthKey}-01`);
  return { from: monthStart.valueOf(), to: monthStart.endOf('month').valueOf(), windowHours };
}

/**
 * Days to mark in consultation mode: the local days of the symptoms that make up a reported pattern.
 * "Patrón detectado" wins over "Vigilar posible patrón" on the same day.
 */
export function markPatternDays(
  patterns: readonly PatternView[],
  dayOfEvent: (eventId: string) => string | undefined,
): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const pattern of patterns) {
    const mark: DayMark = pattern.category === 'Patrón detectado' ? 'detected' : 'watch';
    for (const eventId of pattern.symptomEventIds) {
      const dayKey = dayOfEvent(eventId);
      if (dayKey && marks.get(dayKey) !== 'detected') {
        marks.set(dayKey, mark);
      }
    }
  }
  return marks;
}

/**
 * Day marks of one visible month, with the same query as the insights panel (each month on its own).
 * Empty outside consultation mode, so nothing is computed then.
 */
export function usePatternDayMarks(monthKey: () => string): ComputedRef<Map<string, DayMark>> {
  const eventStore = useEventStore();
  const profileStore = useProfileStore();
  const { consultationMode } = useViewMode();

  return computed(() => {
    if (!consultationMode.value) {
      return new Map<string, DayMark>();
    }
    const patterns = collectPatterns(monthPatternQuery(monthKey(), profileStore.activeProfile.correlationWindowHours));
    const dayById = new Map(eventStore.logs.map((log) => [log.id, dayjs(log.loggedAt).format(DAY_KEY_FORMAT)]));
    return markPatternDays(patterns, (eventId) => dayById.get(eventId));
  });
}

/** Correlations of the visible month, shown in the insights panel. */
export function usePatterns(): {
  watchPatterns: ComputedRef<PatternView[]>;
  detectedPatterns: ComputedRef<PatternView[]>;
} {
  const { activeMonthKey } = useCalendar();
  const profileStore = useProfileStore();

  const patterns = computed(() =>
    collectPatterns(monthPatternQuery(activeMonthKey.value, profileStore.activeProfile.correlationWindowHours)),
  );
  const split = computed(() => splitByCategory(patterns.value));

  return {
    watchPatterns: computed(() => split.value.watch),
    detectedPatterns: computed(() => split.value.detected),
  };
}
