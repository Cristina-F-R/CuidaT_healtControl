import { detectCorrelations, markPatternDays } from '@cuidat/shared';
import type { CorrelationWindowHours, DayMark, HealthEvent, PatternCategory } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { DAY_KEY_FORMAT } from './useCalendar';
import { useMultiMonth } from './useMultiMonth';
import { useViewMode } from './useViewMode';

const MS_PER_HOUR = 3_600_000;

export interface PatternView {
  key: string;
  triggerLabel: string;
  symptomLabel: string;
  occurrences: number;
  category: PatternCategory;
  /** Symptom logs that make up the pattern. */
  symptomEventIds: string[];
  /** Trigger/medication logs behind the pattern: the days marked in consultation mode. */
  triggerEventIds: string[];
}

export type { DayMark };

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
    triggerEventIds: pattern.triggerEventIds,
  }));
}

/** Splits patterns by threshold for the two sections of the UI. */
export function splitByCategory(patterns: readonly PatternView[]): { watch: PatternView[]; detected: PatternView[] } {
  return {
    watch: patterns.filter((pattern) => pattern.category === 'Vigilar posible patrón'),
    detected: patterns.filter((pattern) => pattern.category === 'Patrón detectado'),
  };
}

/**
 * The visible months (density 1M, 2M or 3M) as one range: their symptoms and, through the window,
 * the triggers logged just before the oldest one. The month keys may come in any order.
 */
export function visiblePatternQuery(monthKeys: readonly string[], windowHours: CorrelationWindowHours): PatternQuery {
  const sorted = [...monthKeys].sort();
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  if (!oldest || !newest) {
    throw new Error('visiblePatternQuery needs at least one month');
  }
  return { from: dayjs(`${oldest}-01`).valueOf(), to: dayjs(`${newest}-01`).endOf('month').valueOf(), windowHours };
}

/** Correlations of the visible months: the insights rail and the consultation day marks share this query. */
function useVisiblePatterns(): ComputedRef<PatternView[]> {
  const { visibleMonthKeys } = useMultiMonth();
  const profileStore = useProfileStore();

  return computed(() =>
    collectPatterns(visiblePatternQuery(visibleMonthKeys.value, profileStore.activeProfile.correlationWindowHours)),
  );
}

/**
 * Day marks of the visible months, with the same query as the insights panel (the whole visible range).
 * Empty outside consultation mode, so nothing is computed then.
 */
export function usePatternDayMarks(): ComputedRef<Map<string, DayMark>> {
  const eventStore = useEventStore();
  const { consultationMode } = useViewMode();
  const patterns = useVisiblePatterns();

  return computed(() => {
    if (!consultationMode.value) {
      return new Map<string, DayMark>();
    }
    const dayById = new Map(eventStore.logs.map((log) => [log.id, dayjs(log.loggedAt).format(DAY_KEY_FORMAT)]));
    return markPatternDays(patterns.value, (eventId) => dayById.get(eventId));
  });
}

/** Correlations of the visible months, shown in the insights panel. */
export function usePatterns(): {
  watchPatterns: ComputedRef<PatternView[]>;
  detectedPatterns: ComputedRef<PatternView[]>;
} {
  const patterns = useVisiblePatterns();
  const split = computed(() => splitByCategory(patterns.value));

  return {
    watchPatterns: computed(() => split.value.watch),
    detectedPatterns: computed(() => split.value.detected),
  };
}
