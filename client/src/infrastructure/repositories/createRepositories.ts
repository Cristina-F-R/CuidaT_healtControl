import type { Repositories } from '../../application/ports/repositories';
import { ApiEventRepository } from '../api/ApiEventRepository';
import { ApiItemRepository } from '../api/ApiItemRepository';
import { ApiProfileRepository } from '../api/ApiProfileRepository';
import { browserKeyValueStore } from '../sync/keyValueStore';
import type { KeyValueStore } from '../sync/keyValueStore';
import { clearOfflineCache, OfflineCache } from '../sync/OfflineCache';
import { SyncQueue } from '../sync/SyncQueue';
import { GuestStorage } from './guestStorage';
import { LocalEventRepository } from './LocalEventRepository';
import { LocalItemRepository } from './LocalItemRepository';
import { LocalProfileRepository } from './LocalProfileRepository';

/** Where the data lives: the browser (guest) or the API of a signed-in user. */
export type DataSource = { kind: 'local' } | { kind: 'api'; userId: string };

let store: KeyValueStore | null = null;
let queue: SyncQueue | null = null;
let current: { key: string; repositories: Repositories } | null = null;

function keyValueStore(): KeyValueStore {
  store ??= browserKeyValueStore();
  return store;
}

/** The single offline queue of the browser (ADR-007). */
export function getSyncQueue(): SyncQueue {
  queue ??= new SyncQueue(keyValueStore());
  return queue;
}

/** The store picks the implementation by `authMode` (TECH_SPEC.md section 3.1). */
export function createRepositories(source: DataSource): Repositories {
  const key = source.kind === 'api' ? `api:${source.userId}` : 'local';
  if (current?.key === key) {
    return current.repositories;
  }
  let repositories: Repositories;
  if (source.kind === 'api') {
    const cache = new OfflineCache(keyValueStore(), source.userId);
    repositories = {
      profiles: new ApiProfileRepository(cache),
      items: new ApiItemRepository(cache),
      events: new ApiEventRepository(source.userId, getSyncQueue(), cache),
    };
  } else {
    const guest = new GuestStorage();
    repositories = {
      profiles: new LocalProfileRepository(guest),
      items: new LocalItemRepository(guest),
      events: new LocalEventRepository(guest),
    };
  }
  current = { key, repositories };
  return repositories;
}

/** Wipes the offline copy of a registered user's data (sign-out). The queue must be empty by then. */
export async function clearOfflineData(): Promise<void> {
  await clearOfflineCache(keyValueStore());
}

/** Wipes the queue, its dead-letter list and the offline copy (account deletion, ADR-020). */
export async function clearAllRegisteredData(): Promise<void> {
  await getSyncQueue().clear();
  await clearOfflineData();
}

/** Tests: start every case with fresh in-memory storage. */
export function resetDataLayerForTests(replacement: KeyValueStore): void {
  store = replacement;
  queue = null;
  current = null;
}
