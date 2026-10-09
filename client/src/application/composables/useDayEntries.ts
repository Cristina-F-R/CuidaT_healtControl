import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useEventStore } from '../stores/useEventStore';
import type { EventFilter } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';

export interface DayEntry {
  log: HealthEventLog;
  item: HealthItemDefinition;
}

function matchesFilter(item: HealthItemDefinition, filter: EventFilter): boolean {
  if (filter === 'symptoms') {
    return item.category === 'symptom';
  }
  if (filter === 'triggers') {
    return item.category !== 'symptom';
  }
  return true;
}

/** Visible entries per local day, joined with their own item version and filtered. */
export function useDayEntries(): { entriesByDay: ComputedRef<Map<string, DayEntry[]>> } {
  const eventStore = useEventStore();
  const itemStore = useItemDefinitionStore();
  const { logsByDay, activeFilter } = storeToRefs(eventStore);

  const entriesByDay = computed(() => {
    const result = new Map<string, DayEntry[]>();
    for (const [dayKey, logs] of logsByDay.value) {
      const entries: DayEntry[] = [];
      for (const log of logs) {
        const item = itemStore.findById(log.itemDefinitionId);
        if (item && matchesFilter(item, activeFilter.value)) {
          entries.push({ log, item });
        }
      }
      result.set(dayKey, entries);
    }
    return result;
  });

  return { entriesByDay };
}
