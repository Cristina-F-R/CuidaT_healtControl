import type { CalendarProfile, HealthEventLog, HealthItemDefinition, ItemStatus } from '@cuidat/shared';

// Ports (TECH_SPEC.md section 3.1): application code depends on these interfaces only.

export interface AccountRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface AccountSummary {
  id: string;
  email: string;
}

/** Calendar data of a guest, already validated and with server-generated ids. */
export interface GuestImport {
  profile: CalendarProfile;
  items: HealthItemDefinition[];
  logs: HealthEventLog[];
}

export interface NewAccount {
  email: string;
  passwordHash: string;
  guest: GuestImport | null;
}

export interface AccountRepository {
  findByEmail(email: string): Promise<AccountRecord | null>;
  findById(id: string): Promise<AccountSummary | null>;
  /**
   * Creates the account and its imported calendar in one transaction (TECH_SPEC.md use case 4).
   * Throws ConflictError when the email is already registered.
   */
  createAccount(account: NewAccount): Promise<AccountSummary>;
  /**
   * Deletes the user and, through ON DELETE CASCADE, every calendar, item and log, in one
   * transaction (GDPR Art. 17). Returns false when the user no longer exists.
   */
  deleteAccount(id: string): Promise<boolean>;
}

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(plainText: string, hash: string): Promise<boolean>;
}

export interface SessionTokens {
  /** Signed token for the user, valid for the configured lifetime. */
  issue(userId: string): string;
  /** The user id of a valid token, or `null` (bad signature, expired, malformed). */
  verify(token: string): string | null;
}

/** Owner and calendar of every data operation: repositories filter by both (TECH_SPEC.md section 7). */
export interface CalendarScope {
  userId: string;
  calendarId: string;
}

export type ProfileChanges = Partial<Pick<CalendarProfile, 'name' | 'profileType' | 'avatarIcon' | 'colorTheme' | 'correlationWindowHours'>>;

export interface ProfileRepository {
  list(userId: string): Promise<CalendarProfile[]>;
  /** `null` when the profile does not exist or belongs to another user. */
  find(userId: string, profileId: string): Promise<CalendarProfile | null>;
  create(userId: string, profile: CalendarProfile): Promise<void>;
  update(userId: string, profileId: string, changes: ProfileChanges): Promise<CalendarProfile | null>;
  /**
   * Deletes the profile (cascade: items and logs) unless it is the user's last one. Locks the user's
   * profiles first, so two concurrent deletions cannot both pass the check (ADR-003).
   */
  removeUnlessLast(userId: string, profileId: string): Promise<'deleted' | 'last' | 'not_found'>;
}

export interface ItemRepository {
  list(scope: CalendarScope, status?: ItemStatus): Promise<HealthItemDefinition[]>;
  /** Inserts new item versions; `false` when the calendar does not belong to the user. */
  insert(scope: CalendarScope, items: readonly HealthItemDefinition[]): Promise<boolean>;
  /**
   * Runs `change` on the locked lineage inside one transaction and writes the difference: status,
   * name and emoji updates in place (supersede first) and inserts for new versions. `null` when the
   * lineage does not exist in the calendar.
   */
  updateLineage(
    scope: CalendarScope,
    rootId: string,
    change: (lineage: HealthItemDefinition[]) => HealthItemDefinition[],
  ): Promise<HealthItemDefinition[] | null>;
  /** Number of logs of every version of the lineage; `null` when the lineage does not exist. */
  countLineageLogs(scope: CalendarScope, rootId: string): Promise<number | null>;
  /** Deletes the root, so the whole lineage and its logs go by cascade. */
  removeLineage(scope: CalendarScope, rootId: string): Promise<void>;
}

export interface EventRange {
  from: Date;
  to: Date;
}

export type EventUpsertOutcome =
  | { kind: 'saved'; log: HealthEventLog }
  /** The stored row is newer (last write wins): nothing changed. */
  | { kind: 'stale'; log: HealthEventLog }
  /** The id exists in another calendar: nothing changed. */
  | { kind: 'conflict' }
  /** The item version does not exist in this calendar. */
  | { kind: 'item_not_found' };

export interface EventRepository {
  list(scope: CalendarScope, range: EventRange): Promise<HealthEventLog[]>;
  /**
   * Idempotent upsert by client id in one transaction. `check` receives the item version and the
   * stored row (if any), runs with the row locked, throws when the log breaks a rule and returns the
   * validated row to write.
   */
  upsert(
    scope: CalendarScope,
    log: HealthEventLog,
    check: (item: HealthItemDefinition, existing: HealthEventLog | null) => HealthEventLog,
  ): Promise<EventUpsertOutcome>;
  /** Idempotent: deleting a missing log is not an error. */
  remove(scope: CalendarScope, logId: string): Promise<void>;
}
