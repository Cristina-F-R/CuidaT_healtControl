import type { CalendarProfile, HealthEventLog, HealthItemDefinition } from '@cuidat/shared';

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
