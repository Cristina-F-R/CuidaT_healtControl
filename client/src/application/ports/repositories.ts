import type { CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';

// Repository ports (TECH_SPEC.md section 3.1): stores depend on these interfaces only.
// Implementations live in `infrastructure`: Local... for guests (localStorage), Api... in Phase 3.2.
// Methods are asynchronous so the API implementation can replace the local one without changes here.

export interface ProfileRepository {
  list(): Promise<CalendarProfile[]>;
  /** Insert or update by id. */
  save(profile: CalendarProfile): Promise<void>;
  /** Deletes the profile and, by cascade, its items and logs. */
  remove(profileId: string): Promise<void>;
}

export interface ItemRepository {
  list(calendarId: string): Promise<HealthItemDefinition[]>;
  /** Insert or update by id; every version of a lineage is a separate row. */
  save(items: readonly HealthItemDefinition[]): Promise<void>;
  /** Deletes every version of the lineage and, by cascade, all of their logs. */
  removeLineage(calendarId: string, rootId: string): Promise<void>;
}

export interface EventRepository {
  list(calendarId: string): Promise<HealthEventLog[]>;
  /** Insert or update by id. */
  save(log: HealthEventLog): Promise<void>;
  remove(logId: string): Promise<void>;
}
