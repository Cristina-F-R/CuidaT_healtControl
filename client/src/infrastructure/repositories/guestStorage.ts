import { GUEST_STORAGE_KEY } from '@cuidat/shared';
import type { CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';

/** Where an unreadable guest document is kept before it is replaced. */
export const GUEST_BACKUP_KEY = `${GUEST_STORAGE_KEY}.corrupto`;

/** Whole guest dataset, stored as one JSON document under `@cuidat_guest_v1`. */
export interface GuestDocument {
  version: 1;
  profiles: CalendarProfile[];
  items: HealthItemDefinition[];
  logs: HealthEventLog[];
}

export function createEmptyGuestDocument(): GuestDocument {
  return { version: 1, profiles: [], items: [], logs: [] };
}

function isGuestDocument(value: unknown): value is GuestDocument {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<Record<keyof GuestDocument, unknown>>;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.profiles) &&
    Array.isArray(candidate.items) &&
    Array.isArray(candidate.logs)
  );
}

/** Parses a stored document; `null` when it cannot be read. */
function parseDocument(raw: string): GuestDocument | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isGuestDocument(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Reads and writes the guest document. An unreadable document is read as empty, but it is not
 * lost: the next write keeps the raw text under GUEST_BACKUP_KEY before replacing it.
 */
export class GuestStorage {
  private readonly storage: Storage;

  constructor(storage: Storage = window.localStorage) {
    this.storage = storage;
  }

  read(): GuestDocument {
    const raw = this.storage.getItem(GUEST_STORAGE_KEY);
    if (raw === null) {
      return createEmptyGuestDocument();
    }
    return parseDocument(raw) ?? createEmptyGuestDocument();
  }

  write(document: GuestDocument): void {
    const current = this.storage.getItem(GUEST_STORAGE_KEY);
    // A failing backup throws before the main key is touched, so nothing is overwritten silently.
    // The first unreadable copy is kept; a later one does not replace it.
    if (current !== null && parseDocument(current) === null && this.storage.getItem(GUEST_BACKUP_KEY) === null) {
      this.storage.setItem(GUEST_BACKUP_KEY, current);
    }
    this.storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(document));
  }
}

/** Insert-or-replace by id, keeping the original position of existing rows. */
export function upsertById<T extends { id: string }>(rows: readonly T[], row: T): T[] {
  return rows.some((existing) => existing.id === row.id)
    ? rows.map((existing) => (existing.id === row.id ? row : existing))
    : [...rows, row];
}

/** Removes the guest document and its backup (ADR-020: after account deletion). */
export function clearGuestStorage(storage: Storage = window.localStorage): void {
  storage.removeItem(GUEST_STORAGE_KEY);
  storage.removeItem(GUEST_BACKUP_KEY);
}

/** The guest calendar to import on registration, or `null` when there is nothing stored. */
export function readGuestDataForImport(storage: GuestStorage = new GuestStorage()): GuestDocument | null {
  const document = storage.read();
  return document.profiles.length > 0 ? document : null;
}
