import { validateEventLogFields } from '@cuidat/shared';
import type { HealthEventLog, HealthItemDefinition, Intensity } from '@cuidat/shared';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createRepositories } from '../../infrastructure/repositories/createRepositories';
import { DAY_KEY_FORMAT } from '../composables/useCalendar';
import { sanitizeText } from '../sanitizeText';
import { useAuthStore } from './useAuthStore';

export type EventFilter = 'all' | 'symptoms' | 'triggers';

/** What the event modal sends. `existing` is set when editing; new logs get a fresh UUID. */
export interface EventLogDraft {
  existing: HealthEventLog | null;
  calendarId: string;
  /** The item version the log belongs to (for edits, the version the log already references). */
  item: HealthItemDefinition;
  /** ISO 8601 UTC instant. */
  loggedAt: string;
  intensity: Intensity | null;
  durationMinutes: number | null;
  notes: string;
}

/** Stable chronological order (ADR-016): logged_at, then created_at, then id. */
function compareLogs(a: HealthEventLog, b: HealthEventLog): number {
  return a.loggedAt.localeCompare(b.loggedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export const useEventStore = defineStore('events', () => {
  const authStore = useAuthStore();
  const repositories = createRepositories(authStore.authMode);

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

  async function loadLogs(calendarId: string): Promise<void> {
    logs.value = await repositories.events.list(calendarId);
  }

  /** Validates against the item version (TECH_SPEC.md use cases 1 and 8) and stores the log. */
  async function saveLog(draft: EventLogDraft): Promise<HealthEventLog> {
    const now = new Date();
    const fields = validateEventLogFields(
      draft.item,
      {
        loggedAt: draft.loggedAt,
        intensity: draft.intensity,
        durationMinutes: draft.durationMinutes,
        notes: sanitizeText(draft.notes),
      },
      { isNew: draft.existing === null, now },
    );

    const timestamp = now.toISOString();
    const log: HealthEventLog = draft.existing
      ? { ...draft.existing, ...fields, updatedAt: timestamp }
      : {
          id: crypto.randomUUID(),
          calendarId: draft.calendarId,
          itemDefinitionId: draft.item.id,
          ...fields,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

    await repositories.events.save(log);
    logs.value = [...logs.value.filter((existing) => existing.id !== log.id), log];
    return log;
  }

  async function removeLog(logId: string): Promise<void> {
    await repositories.events.remove(logId);
    logs.value = logs.value.filter((log) => log.id !== logId);
  }

  function resetState(): void {
    logs.value = [];
    activeFilter.value = 'all';
  }

  return { logs, activeFilter, logsByDay, loadLogs, saveLog, removeLog, resetState };
});
