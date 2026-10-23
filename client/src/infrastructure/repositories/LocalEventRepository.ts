import type { HealthEventLog } from '@cuidat/shared';
import type { EventRepository, LogRange } from '../../application/ports/repositories';
import type { GuestStorage } from './guestStorage';
import { upsertById } from './guestStorage';

export class LocalEventRepository implements EventRepository {
  private readonly guest: GuestStorage;

  constructor(guest: GuestStorage) {
    this.guest = guest;
  }

  async list(calendarId: string, range: LogRange): Promise<HealthEventLog[]> {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    return this.guest.read().logs.filter((log) => {
      const instant = Date.parse(log.loggedAt);
      return log.calendarId === calendarId && instant >= from && instant <= to;
    });
  }

  /** The guest has no queue, so whether the log is new does not matter here. */
  async save(log: HealthEventLog): Promise<void> {
    const document = this.guest.read();
    document.logs = upsertById(document.logs, log);
    this.guest.write(document);
  }

  async remove(_calendarId: string, logId: string): Promise<void> {
    const document = this.guest.read();
    document.logs = document.logs.filter((log) => log.id !== logId);
    this.guest.write(document);
  }
}
