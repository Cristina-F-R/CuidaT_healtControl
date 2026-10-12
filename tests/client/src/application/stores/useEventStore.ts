import type { HealthEventLog } from '@cuidat/shared';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { DAY_KEY_FORMAT } from '../composables/useCalendar';

export type EventFilter = 'all' | 'symptoms' | 'triggers';

/** Stable chronological order (ADR-016): logged_at, then created_at, then id. */
function compareLogs(a: HealthEventLog, b: HealthEventLog): number {
  return a.loggedAt.localeCompare(b.loggedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export const useEventStore = defineStore('events', () => {
  // Phase 1: in memory only. Phase 2 persists through repositories.
  const logs = ref<HealthEventLog[]>([]);
  const activeFilter = ref<EventFilter>('all');

  /** Logs grouped by local day (`YYYY-MM-DD`), each group in chronological order. */
  const logsByDay = computed(() => {
    const groups = new Map<string, HealthEventLog[]>();
    for (const log of [...logs.value].sort(compareLogs)) {
      const dayKey = dayjs(log.loggedAt).format(DAY_KEY_FORMAT);
      const group = groups.get(dayKey);
      if (group) {
        group.push(log);
      } else {
        groups.set(dayKey, [log]);
      }
    }
    return groups;
  });

  function addLog(entry: HealthEventLog): void {
    logs.value.push(entry);
  }

  function resetState(): void {
    logs.value = [];
    activeFilter.value = 'all';
  }

  return { logs, activeFilter, logsByDay, addLog, resetState };
});
