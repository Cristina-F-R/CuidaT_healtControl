import { removeLineage } from '@cuidat/shared';
import type { HealthItemDefinition } from '@cuidat/shared';
import type { ItemRepository } from '../../application/ports/repositories';
import type { GuestStorage } from './guestStorage';
import { upsertById } from './guestStorage';

export class LocalItemRepository implements ItemRepository {
  private readonly guest: GuestStorage;

  constructor(guest: GuestStorage) {
    this.guest = guest;
  }

  async list(calendarId: string): Promise<HealthItemDefinition[]> {
    return this.guest.read().items.filter((item) => item.calendarId === calendarId);
  }

  async save(items: readonly HealthItemDefinition[]): Promise<void> {
    const document = this.guest.read();
    document.items = items.reduce((rows, item) => upsertById(rows, item), document.items);
    this.guest.write(document);
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
}
