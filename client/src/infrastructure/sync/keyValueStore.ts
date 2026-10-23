import localforage from 'localforage';

/** The part of LocalForage the sync queue and the offline cache use; tests pass an in-memory one. */
export interface KeyValueStore {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<T>;
  removeItem(key: string): Promise<void>;
}

let browserStore: KeyValueStore | null = null;

/** IndexedDB through LocalForage (ADR-007), created on first use. */
export function browserKeyValueStore(): KeyValueStore {
  browserStore ??= localforage.createInstance({ name: 'cuidat', storeName: 'sync' });
  return browserStore;
}

export function createMemoryStore(): KeyValueStore {
  const values = new Map<string, unknown>();
  return {
    async getItem<T>(key: string): Promise<T | null> {
      // Values are cloned like IndexedDB does, so callers never share references with the store.
      return values.has(key) ? (structuredClone(values.get(key)) as T) : null;
    },
    async setItem<T>(key: string, value: T): Promise<T> {
      values.set(key, structuredClone(value));
      return value;
    },
    async removeItem(key: string): Promise<void> {
      values.delete(key);
    },
  };
}
