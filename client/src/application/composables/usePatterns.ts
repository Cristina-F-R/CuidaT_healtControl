import { detectCorrelations } from '@cuidat/shared';
import type { HealthEvent, PatternCategory } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useCalendar } from './useCalendar';

export interface PatternView {
  key: string;
  triggerLabel: string;
  symptomLabel: string;
  occurrences: number;
  category: PatternCategory;
}

/**
 * Correlations of the visible month (TECH_SPEC.md section 6). Symptoms are counted inside the month;
 * triggers may come up to one correlation window earlier, so a symptom at the start of the month
 * still finds its trigger.
 */
export function usePatterns(): {
  watchPatterns: ComputedRef<PatternView[]>;
  detectedPatterns: ComputedRef<PatternView[]>;
} {
  const { activeMonthKey } = useCalendar();
  const eventStore = useEventStore();
  const itemStore = useItemDefinitionStore();
  const profileStore = useProfileStore();

  function labelOf(rootId: string): string {
    const live = itemStore.findLiveByRoot(rootId);
    return live ? `${live.emoji} ${live.name}` : 'Ítem eliminado';
  }

  const patterns = computed<PatternView[]>(() => {
    const windowHours = profileStore.activeProfile.correlationWindowHours;
    const monthStart = dayjs(`${activeMonthKey.value}-01`);
    const monthFrom = monthStart.valueOf();
    const monthTo = monthStart.endOf('month').valueOf();
    const triggerFrom = monthStart.subtract(windowHours, 'hour').valueOf();

    const events: HealthEvent[] = [];
    for (const log of eventStore.logs) {
      const item = itemStore.findById(log.itemDefinitionId);
      if (!item) {
        continue;
      }
      const instant = Date.parse(log.loggedAt);
      const inScope =
        item.category === 'symptom'
          ? instant >= monthFrom && instant <= monthTo
          : instant >= triggerFrom && instant <= monthTo;
      if (inScope) {
        events.push({
          id: log.id,
          itemDefinitionId: item.id,
          rootItemId: item.rootId,
          category: item.category,
          loggedAt: log.loggedAt,
          createdAt: log.createdAt,
        });
      }
    }

    return detectCorrelations(events, windowHours).map((pattern) => ({
      key: `${pattern.triggerRootId}|${pattern.symptomRootId}`,
      triggerLabel: labelOf(pattern.triggerRootId),
      symptomLabel: labelOf(pattern.symptomRootId),
      occurrences: pattern.occurrences,
      category: pattern.category,
    }));
  });

  return {
    watchPatterns: computed(() => patterns.value.filter((pattern) => pattern.category === 'Vigilar posible patrón')),
    detectedPatterns: computed(() => patterns.value.filter((pattern) => pattern.category === 'Patrón detectado')),
  };
}
