import type { CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import type { KeyValueStore } from './keyValueStore';

export const OFFLINE_CACHE_KEY = '@cuidat_cache_v1';

// One browser store, so one queue of writes for every instance.
let writes: Promise<unknown> = Promise.resolve();

/** Last data read from the API, so a reload without connection still shows the calendar (PWA). */
interface CacheDocument {
  userId: string;
  profiles: CalendarProfile[];
  items: Record<string, HealthItemDefinition[]>;
  logs: Record<string, HealthEventLog[]>;
}

function upsertRows<T extends { id: string }>(rows: readonly T[], changed: readonly T[]): T[] {
  const ids = new Set(changed.map((row) => row.id));
  return [...rows.filter((row) => !ids.has(row.id)), ...changed];
}

/**
 * Read cache of a registered user's data in IndexedDB. It belongs to one user: another user's
 * cache reads as empty. It is wiped on sign-out and on account deletion (privacy, ADR-020).
 */
export class OfflineCache {
  private readonly store: KeyValueStore;
  private readonly userId: string;

  constructor(store: KeyValueStore, userId: string) {
    this.store = store;
    this.userId = userId;
  }

  async profiles(): Promise<CalendarProfile[] | null> {
    const document = await this.read();
    return document.profiles.length > 0 ? document.profiles : null;
  }

  async items(calendarId: string): Promise<HealthItemDefinition[] | null> {
    return (await this.read()).items[calendarId] ?? null;
  }

  async logs(calendarId: string): Promise<HealthEventLog[]> {
    return (await this.read()).logs[calendarId] ?? [];
  }

  async putProfiles(profiles: CalendarProfile[]): Promise<void> {
    await this.update((document) => ({ ...document, profiles }));
  }

  async putItems(calendarId: string, items: HealthItemDefinition[]): Promise<void> {
    await this.update((document) => ({ ...document, items: { ...document.items, [calendarId]: items } }));
  }

  /** Adds or replaces versions after a catalog change. */
  async mergeItems(calendarId: string, changed: HealthItemDefinition[]): Promise<void> {
    await this.update((document) => ({
      ...document,
      items: { ...document.items, [calendarId]: upsertRows(document.items[calendarId] ?? [], changed) },
    }));
  }

  async removeLineage(calendarId: string, rootId: string): Promise<void> {
    await this.update((document) => ({
      ...document,
      items: { ...document.items, [calendarId]: (document.items[calendarId] ?? []).filter((item) => item.rootId !== rootId) },
    }));
  }

  /** Replaces the cached logs inside the fetched range and keeps the rest. */
  async putLogs(calendarId: string, range: { from: string; to: string }, logs: HealthEventLog[]): Promise<void> {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    await this.update((document) => {
      const outside = (document.logs[calendarId] ?? []).filter((log) => {
        const instant = Date.parse(log.loggedAt);
        return instant < from || instant > to;
      });
      return { ...document, logs: { ...document.logs, [calendarId]: [...outside, ...logs] } };
    });
  }

  private async read(): Promise<CacheDocument> {
    const stored = await this.store.getItem<CacheDocument>(OFFLINE_CACHE_KEY);
    return stored?.userId === this.userId ? stored : { userId: this.userId, profiles: [], items: {}, logs: {} };
  }

  /** Serialised read-modify-write: items and logs are cached in parallel when the workspace loads. */
  private update(change: (document: CacheDocument) => CacheDocument): Promise<void> {
    const result = writes.then(async () => {
      await this.store.setItem(OFFLINE_CACHE_KEY, change(await this.read()));
    });
    writes = result.catch(() => undefined);
    return result;
  }
}

export async function clearOfflineCache(store: KeyValueStore): Promise<void> {
  await store.removeItem(OFFLINE_CACHE_KEY);
}
