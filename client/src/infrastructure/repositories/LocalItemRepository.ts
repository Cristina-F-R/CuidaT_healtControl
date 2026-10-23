import {
  archiveItem,
  countLineageLogs,
  createItemDefinition,
  createPresetItems,
  editItem,
  removeLineage,
  restoreItem,
} from '@cuidat/shared';
import type { HealthItemDefinition, ItemDraft, ItemEditPatch } from '@cuidat/shared';
import type { ItemRepository } from '../../application/ports/repositories';
import type { GuestStorage } from './guestStorage';

/** Guest catalog: the same pure rules the server runs (shared/src/catalog.ts), on localStorage. */
export class LocalItemRepository implements ItemRepository {
  private readonly guest: GuestStorage;

  constructor(guest: GuestStorage) {
    this.guest = guest;
  }

  async list(calendarId: string): Promise<HealthItemDefinition[]> {
    return this.guest.read().items.filter((item) => item.calendarId === calendarId);
  }

  async create(calendarId: string, draft: ItemDraft): Promise<HealthItemDefinition> {
    const item = createItemDefinition(calendarId, draft, crypto.randomUUID(), new Date().toISOString());
    this.writeItems((items) => [...items, item]);
    return item;
  }

  async addPresets(calendarId: string): Promise<HealthItemDefinition[]> {
    const presets = createPresetItems(calendarId, () => crypto.randomUUID(), new Date());
    this.writeItems((items) => [...items, ...presets]);
    return presets;
  }

  async edit(calendarId: string, rootId: string, patch: ItemEditPatch): Promise<HealthItemDefinition[]> {
    return this.changeLineage(calendarId, rootId, (items) =>
      editItem(items, rootId, patch, { newId: crypto.randomUUID(), now: new Date().toISOString() }),
    );
  }

  async archive(calendarId: string, rootId: string): Promise<HealthItemDefinition[]> {
    return this.changeLineage(calendarId, rootId, (items) => archiveItem(items, rootId));
  }

  async restore(calendarId: string, rootId: string): Promise<HealthItemDefinition[]> {
    return this.changeLineage(calendarId, rootId, (items) => restoreItem(items, rootId));
  }

  async deleteImpact(calendarId: string, rootId: string): Promise<number> {
    const document = this.guest.read();
    return countLineageLogs(
      document.items.filter((item) => item.calendarId === calendarId),
      document.logs.filter((log) => log.calendarId === calendarId),
      rootId,
    );
  }

  async removeLineage(calendarId: string, rootId: string): Promise<void> {
    const document = this.guest.read();
    const snapshot = removeLineage(
      document.items.filter((item) => item.calendarId === calendarId),
      document.logs.filter((log) => log.calendarId === calendarId),
      rootId,
    );
    document.items = [...document.items.filter((item) => item.calendarId !== calendarId), ...snapshot.items];
    document.logs = [...document.logs.filter((log) => log.calendarId !== calendarId), ...snapshot.logs];
    this.guest.write(document);
  }

  private writeItems(change: (items: HealthItemDefinition[]) => HealthItemDefinition[]): void {
    const document = this.guest.read();
    document.items = change(document.items);
    this.guest.write(document);
  }

  private changeLineage(
    calendarId: string,
    rootId: string,
    change: (items: HealthItemDefinition[]) => HealthItemDefinition[],
  ): HealthItemDefinition[] {
    const document = this.guest.read();
    const others = document.items.filter((item) => item.calendarId !== calendarId);
    const next = change(document.items.filter((item) => item.calendarId === calendarId));
    document.items = [...others, ...next];
    this.guest.write(document);
    return next.filter((item) => item.rootId === rootId);
  }
}
