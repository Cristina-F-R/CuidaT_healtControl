import { CORRELATION_WINDOWS, FUTURE_TOLERANCE_MINUTES, validateEventLogFields } from '@cuidat/shared';
import type { HealthEventLog, HealthItemDefinition, Intensity } from '@cuidat/shared';
import dayjs from 'dayjs';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { LogRange } from '../ports/repositories';
import { DAY_KEY_FORMAT } from '../composables/useCalendar';
import { sanitizeText } from '../sanitizeText';
import { currentRepositories } from './currentRepositories';
import { useAuthStore } from './useAuthStore';
import { useSyncStore } from './useSyncStore';

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

/** Triggers of the first visible day can come up to the widest correlation window earlier. */
const MAX_WINDOW_HOURS = Math.max(...CORRELATION_WINDOWS);
/** Initial load (TECH_SPEC.md use case 9): the current month and the two before it. */
const INITIAL_MONTHS = 3;

/** First instant needed to show `monthStart` with its correlations. */
function neededFrom(monthStart: dayjs.Dayjs): dayjs.Dayjs {
  return monthStart.subtract(MAX_WINDOW_HOURS, 'hour');
}

/** Stable chronological order (ADR-016): logged_at, then created_at, then id. */
function compareLogs(a: HealthEventLog, b: HealthEventLog): number {
  return a.loggedAt.localeCompare(b.loggedAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export const useEventStore = defineStore('events', () => {
  const authStore = useAuthStore();

  const logs = ref<HealthEventLog[]>([]);
  const activeFilter = ref<EventFilter>('all');
  /** Calendar and earliest instant loaded so far; older months are fetched on demand. */
  let loaded: { calendarId: string; from: dayjs.Dayjs } | null = null;

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
    const from = neededFrom(dayjs().subtract(INITIAL_MONTHS - 1, 'month').startOf('month'));
    const range: LogRange = { from: from.toISOString(), to: dayjs().add(FUTURE_TOLERANCE_MINUTES, 'minute').toISOString() };
    logs.value = await currentRepositories().events.list(calendarId, range);
    loaded = { calendarId, from };
  }

  /** Fetches the logs a month needs (with its correlation window) when it is older than the loaded range. */
  async function ensureMonthLoaded(calendarId: string, monthKey: string): Promise<void> {
    const from = neededFrom(dayjs(`${monthKey}-01`));
    if (!loaded || loaded.calendarId !== calendarId || !from.isBefore(loaded.from)) {
      return;
    }
    const range: LogRange = { from: from.toISOString(), to: loaded.from.subtract(1, 'millisecond').toISOString() };
    const older = await currentRepositories().events.list(calendarId, range);
    const known = new Set(logs.value.map((log) => log.id));
    logs.value = [...logs.value, ...older.filter((log) => !known.has(log.id))];
    loaded = { calendarId, from };
  }

  /** Registered users: the change is queued; count it and send it when there is connection (ADR-007). */
  function afterLocalChange(): void {
    if (authStore.isSignedIn) {
      void useSyncStore().notifyChange();
    }
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

    await currentRepositories().events.save(log, draft.existing === null);
    logs.value = [...logs.value.filter((existing) => existing.id !== log.id), log];
    afterLocalChange();
    return log;
  }

  async function removeLog(logId: string): Promise<void> {
    const log = logs.value.find((candidate) => candidate.id === logId);
    if (!log) {
      return;
    }
    await currentRepositories().events.remove(log.calendarId, logId);
    logs.value = logs.value.filter((candidate) => candidate.id !== logId);
    afterLocalChange();
  }

  function resetState(): void {
    logs.value = [];
    activeFilter.value = 'all';
    loaded = null;
  }

  return { logs, activeFilter, logsByDay, loadLogs, ensureMonthLoaded, saveLog, removeLog, resetState };
});
