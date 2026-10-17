import type { Pool, PoolClient } from 'pg';
import { ConflictError, InternalError } from '../../domain/errors.js';
import type { AccountRecord, AccountRepository, AccountSummary, GuestImport, NewAccount } from '../../domain/ports.js';

const UNIQUE_VIOLATION = '23505';

/** Column arrays for one multi-row insert: each array is one column, rows keep their order. */
function column<T, K>(rows: readonly T[], pick: (row: T) => K): K[] {
  return rows.map(pick);
}

async function insertCalendar(client: PoolClient, userId: string, guest: GuestImport): Promise<void> {
  const { profile, items, logs } = guest;
  await client.query(
    `INSERT INTO calendar_profiles
       (id, user_id, name, profile_type, avatar_icon, color_theme, correlation_window_hours, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [profile.id, userId, profile.name, profile.profileType, profile.avatarIcon, profile.colorTheme, profile.correlationWindowHours, profile.createdAt],
  );
  // Items are ordered parents first; the constraints are checked at the end of the statement anyway.
  await client.query(
    `INSERT INTO health_item_definitions
       (id, calendar_id, root_id, parent_id, name, emoji, category, track_intensity, track_duration, status, created_at)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::varchar[], $6::varchar[], $7::varchar[],
                          $8::boolean[], $9::boolean[], $10::varchar[], $11::timestamptz[])`,
    [
      column(items, (item) => item.id),
      column(items, (item) => item.calendarId),
      column(items, (item) => item.rootId),
      column(items, (item) => item.parentId),
      column(items, (item) => item.name),
      column(items, (item) => item.emoji),
      column(items, (item) => item.category),
      column(items, (item) => item.trackIntensity),
      column(items, (item) => item.trackDuration),
      column(items, (item) => item.status),
      column(items, (item) => item.createdAt),
    ],
  );
  if (logs.length > 0) {
    await client.query(
      `INSERT INTO health_event_logs
         (id, calendar_id, item_definition_id, logged_at, intensity, duration_minutes, notes, created_at, updated_at)
       SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::timestamptz[], $5::smallint[], $6::int[],
                            $7::varchar[], $8::timestamptz[], $9::timestamptz[])`,
      [
        column(logs, (log) => log.id),
        column(logs, (log) => log.calendarId),
        column(logs, (log) => log.itemDefinitionId),
        column(logs, (log) => log.loggedAt),
        column(logs, (log) => log.intensity),
        column(logs, (log) => log.durationMinutes),
        column(logs, (log) => log.notes),
        column(logs, (log) => log.createdAt),
        column(logs, (log) => log.updatedAt),
      ],
    );
  }
}

export class PgAccountRepository implements AccountRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByEmail(email: string): Promise<AccountRecord | null> {
    const result = await this.pool.query<{ id: string; email: string; password_hash: string }>(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email, passwordHash: row.password_hash } : null;
  }

  async findById(id: string): Promise<AccountSummary | null> {
    const result = await this.pool.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [id]);
    return result.rows[0] ?? null;
  }

  async createAccount(account: NewAccount): Promise<AccountSummary> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<{ id: string; email: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [account.email, account.passwordHash],
      );
      const user = inserted.rows[0];
      if (!user) {
        throw new InternalError('El usuario no se creó.');
      }
      if (account.guest) {
        await insertCalendar(client, user.id, account.guest);
      }
      await client.query('COMMIT');
      return { id: user.id, email: user.email };
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) {
        throw new ConflictError('No se pudo crear la cuenta con ese email.', 'EMAIL_TAKEN');
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}
