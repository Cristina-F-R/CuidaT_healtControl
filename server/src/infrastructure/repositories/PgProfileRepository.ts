import type { Pool } from 'pg';
import type { CalendarProfile } from '@cuidat/shared';
import type { ProfileChanges, ProfileRepository } from '../../domain/ports.js';
import { inTransaction, PROFILE_COLUMNS, toProfile } from './rows.js';
import type { ProfileRow } from './rows.js';

const COLUMN_OF: Record<keyof ProfileChanges, string> = {
  name: 'name',
  profileType: 'profile_type',
  avatarIcon: 'avatar_icon',
  colorTheme: 'color_theme',
  correlationWindowHours: 'correlation_window_hours',
};

export class PgProfileRepository implements ProfileRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(userId: string): Promise<CalendarProfile[]> {
    const result = await this.pool.query<ProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM calendar_profiles p WHERE p.user_id = $1 ORDER BY p.created_at, p.id`,
      [userId],
    );
    return result.rows.map(toProfile);
  }

  async find(userId: string, profileId: string): Promise<CalendarProfile | null> {
    const result = await this.pool.query<ProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM calendar_profiles p WHERE p.user_id = $1 AND p.id = $2`,
      [userId, profileId],
    );
    const row = result.rows[0];
    return row ? toProfile(row) : null;
  }

  async create(userId: string, profile: CalendarProfile): Promise<void> {
    await this.pool.query(
      `INSERT INTO calendar_profiles (id, user_id, name, profile_type, avatar_icon, color_theme, correlation_window_hours, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [profile.id, userId, profile.name, profile.profileType, profile.avatarIcon, profile.colorTheme, profile.correlationWindowHours, profile.createdAt],
    );
  }

  async update(userId: string, profileId: string, changes: ProfileChanges): Promise<CalendarProfile | null> {
    const entries = (Object.keys(COLUMN_OF) as (keyof ProfileChanges)[]).filter((key) => changes[key] !== undefined);
    if (entries.length === 0) {
      return this.find(userId, profileId);
    }
    // Column names come from the fixed map above, never from the request; values are parameters.
    const assignments = entries.map((key, index) => `${COLUMN_OF[key]} = $${index + 3}`).join(', ');
    const result = await this.pool.query<ProfileRow>(
      `UPDATE calendar_profiles p SET ${assignments} WHERE p.user_id = $1 AND p.id = $2 RETURNING ${PROFILE_COLUMNS}`,
      [userId, profileId, ...entries.map((key) => changes[key])],
    );
    const row = result.rows[0];
    return row ? toProfile(row) : null;
  }

  async removeUnlessLast(userId: string, profileId: string): Promise<'deleted' | 'last' | 'not_found'> {
    return inTransaction(this.pool, async (client) => {
      const owned = await client.query<{ id: string }>(
        'SELECT id FROM calendar_profiles WHERE user_id = $1 ORDER BY id FOR UPDATE',
        [userId],
      );
      if (!owned.rows.some((row) => row.id === profileId)) {
        return 'not_found';
      }
      if (owned.rows.length <= 1) {
        return 'last';
      }
      await client.query('DELETE FROM calendar_profiles WHERE user_id = $1 AND id = $2', [userId, profileId]);
      return 'deleted';
    });
  }
}
