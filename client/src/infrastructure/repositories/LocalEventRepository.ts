import type { HealthEventLog } from '@cuidat/shared';
import type { EventRepository } from '../../application/ports/repositories';
import type { GuestStorage } from './guestStorage';
import { upsertById } from './guestStorage';

export class LocalEventRepository implements EventRepository {
  private readonly guest: GuestStorage;

  constructor(guest: GuestStorage) {
    this.guest = guest;
  }

  async list(calendarId: string): Promise<HealthEventLog[]> {
    return this.guest.read().logs.filter((log) => log.calendarId === calendarId);
  }

  async save(log: HealthEventLog): Promise<void> {
    const document = this.guest.read();
    document.logs = upsertById(document.logs, log);
    this.guest.write(document);
  }

  async remove(logId: string): Promise<void> {
    const document = this.guest.read();
    document.logs = document.logs.filter((log) => log.id !== logId);
    this.guest.write(document);
  }
}
