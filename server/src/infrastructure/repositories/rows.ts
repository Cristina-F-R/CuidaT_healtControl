import type { Pool, PoolClient } from 'pg';
import type { CalendarProfile, CorrelationWindowHours, HealthEventLog, HealthItemDefinition, Intensity, ItemCategory, ItemStatus, ProfileColorTheme } from '@cuidat/shared';

// Row <-> entity mapping for the data repositories. Columns are snake_case, entities camelCase.

export const PROFILE_COLUMNS = 'p.id, p.name, p.profile_type, p.avatar_icon, p.color_theme, p.correlation_window_hours, p.created_at';
export const ITEM_COLUMNS =
  'i.id, i.calendar_id, i.root_id, i.parent_id, i.name, i.emoji, i.category, i.track_intensity, i.track_duration, i.status, i.created_at';
export const LOG_COLUMNS =
  'l.id, l.calendar_id, l.item_definition_id, l.logged_at, l.intensity, l.duration_minutes, l.notes, l.created_at, l.updated_at';

export interface ProfileRow {
  id: string;
  name: string;
  profile_type: string;
  avatar_icon: string;
  color_theme: string;
  correlation_window_hours: number;
  created_at: Date;
}

export interface ItemRow {
  id: string;
  calendar_id: string;
  root_id: string;
  parent_id: string | null;
  name: string;
  emoji: string;
  category: string;
  track_intensity: boolean;
  track_duration: boolean;
  status: string;
  created_at: Date;
}

export interface LogRow {
  id: string;
  calendar_id: string;
  item_definition_id: string;
  logged_at: Date;
  intensity: number | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

// The CHECK constraints of 001_init.sql guarantee these narrowings.
export function toProfile(row: ProfileRow): CalendarProfile {
  return {
    id: row.id,
    name: row.name,
    profileType: row.profile_type,
    avatarIcon: row.avatar_icon,
    colorTheme: row.color_theme as ProfileColorTheme,
    correlationWindowHours: row.correlation_window_hours as CorrelationWindowHours,
    createdAt: row.created_at.toISOString(),
  };
}

export function toItem(row: ItemRow): HealthItemDefinition {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    rootId: row.root_id,
    parentId: row.parent_id,
    name: row.name,
    emoji: row.emoji,
    category: row.category as ItemCategory,
    trackIntensity: row.track_intensity,
    trackDuration: row.track_duration,
    status: row.status as ItemStatus,
    createdAt: row.created_at.toISOString(),
  };
}

export function toLog(row: LogRow): HealthEventLog {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    itemDefinitionId: row.item_definition_id,
    loggedAt: row.logged_at.toISOString(),
    intensity: row.intensity as Intensity | null,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Runs `work` in one transaction on a dedicated connection; rolls back on any error. */
export async function inTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Multi-row insert of item versions, parents first (unnest keeps the order). */
export async function insertItems(client: PoolClient | Pool, items: readonly HealthItemDefinition[]): Promise<void> {
  if (items.length === 0) {
    return;
  }
  await client.query(
    `INSERT INTO health_item_definitions
       (id, calendar_id, root_id, parent_id, name, emoji, category, track_intensity, track_duration, status, created_at)
     SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::uuid[], $5::varchar[], $6::varchar[], $7::varchar[],
                          $8::boolean[], $9::boolean[], $10::varchar[], $11::timestamptz[])`,
    [
      items.map((item) => item.id),
      items.map((item) => item.calendarId),
      items.map((item) => item.rootId),
      items.map((item) => item.parentId),
      items.map((item) => item.name),
      items.map((item) => item.emoji),
      items.map((item) => item.category),
      items.map((item) => item.trackIntensity),
      items.map((item) => item.trackDuration),
      items.map((item) => item.status),
      items.map((item) => item.createdAt),
    ],
  );
}
