import type {
  CalendarProfile,
  HealthEventLog,
  HealthItemDefinition,
  ItemDraft,
  ItemEditPatch,
  ProfileDraft,
  ReportCreateBody,
  ReportSummary,
  SavedReport,
} from '@cuidat/shared';

// Repository ports (TECH_SPEC.md section 3.1): stores depend on these interfaces only.
// Implementations live in `infrastructure`: Local... for guests (localStorage) and Api... for
// registered users. They are commands, not "save the whole list": with the API the catalog rules
// run on the server, so the port carries the intent (create, edit, archive...) and returns the result.

export type ProfilePatch = Partial<ProfileDraft>;

export interface ProfileRepository {
  list(): Promise<CalendarProfile[]>;
  create(draft: ProfileDraft): Promise<CalendarProfile>;
  /** Changes the given fields of a calendar and returns the result. */
  update(profileId: string, patch: ProfilePatch): Promise<CalendarProfile>;
  /** Deletes the profile and, by cascade, its items and logs. */
  remove(profileId: string): Promise<void>;
}

export interface ItemRepository {
  /** Every version of every lineage of the calendar. */
  list(calendarId: string): Promise<HealthItemDefinition[]>;
  create(calendarId: string, draft: ItemDraft): Promise<HealthItemDefinition>;
  /** «Añadir ítems de ejemplo»: the six PRESET_ITEMS. */
  addPresets(calendarId: string): Promise<HealthItemDefinition[]>;
  /** The following commands return the whole lineage after the change (ADR-006). */
  edit(calendarId: string, rootId: string, patch: ItemEditPatch): Promise<HealthItemDefinition[]>;
  archive(calendarId: string, rootId: string): Promise<HealthItemDefinition[]>;
  restore(calendarId: string, rootId: string): Promise<HealthItemDefinition[]>;
  /** Number of logs a permanent deletion of the lineage would erase. */
  deleteImpact(calendarId: string, rootId: string): Promise<number>;
  /** Deletes every version of the lineage and, by cascade, all of their logs. */
  removeLineage(calendarId: string, rootId: string): Promise<void>;
}

/** Inclusive range of `logged_at` instants (ISO 8601 UTC). */
export interface LogRange {
  from: string;
  to: string;
}

export interface EventRepository {
  list(calendarId: string, range: LogRange): Promise<HealthEventLog[]>;
  /**
   * Insert or update by the client-generated id. Registered users: queued and synced (ADR-007);
   * `isNew` lets a later delete cancel a creation that never reached the server.
   */
  save(log: HealthEventLog, isNew: boolean): Promise<void>;
  remove(calendarId: string, logId: string): Promise<void>;
}

/** Saved reports (TECH_SPEC.md section 9.1): online only, the server builds the snapshot. */
export interface ReportRepository {
  /** Metadata of every report of the account, newest first. */
  list(): Promise<ReportSummary[]>;
  get(reportId: string): Promise<SavedReport>;
  create(body: ReportCreateBody): Promise<ReportSummary>;
  remove(reportId: string): Promise<void>;
}

export interface Repositories {
  profiles: ProfileRepository;
  items: ItemRepository;
  events: EventRepository;
  /** `null` for guests: reports belong to registered users only. */
  reports: ReportRepository | null;
}
