import { detectCorrelations } from '@cuidat/shared';
import type { CorrelationWindowHours, HealthEvent, PatternCategory } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useCalendar } from './useCalendar';

const MS_PER_HOUR = 3_600_000;

export interface PatternView {
  key: string;
  triggerLabel: string;
  symptomLabel: string;
  occurrences: number;
  category: PatternCategory;
}

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
  }));
}

/** Splits patterns by threshold for the two sections of the UI. */
export function splitByCategory(patterns: readonly PatternView[]): { watch: PatternView[]; detected: PatternView[] } {
  return {
    watch: patterns.filter((pattern) => pattern.category === 'Vigilar posible patrón'),
    detected: patterns.filter((pattern) => pattern.category === 'Patrón detectado'),
  };
}

/** Correlations of the visible month, shown in the insights panel. */
export function usePatterns(): {
  watchPatterns: ComputedRef<PatternView[]>;
  detectedPatterns: ComputedRef<PatternView[]>;
} {
  const { activeMonthKey } = useCalendar();
  const profileStore = useProfileStore();

  const patterns = computed(() => {
    const monthStart = dayjs(`${activeMonthKey.value}-01`);
    return collectPatterns({
      from: monthStart.valueOf(),
      to: monthStart.endOf('month').valueOf(),
      windowHours: profileStore.activeProfile.correlationWindowHours,
    });
  });
  const split = computed(() => splitByCategory(patterns.value));

  return {
    watchPatterns: computed(() => split.value.watch),
    detectedPatterns: computed(() => split.value.detected),
  };
}
