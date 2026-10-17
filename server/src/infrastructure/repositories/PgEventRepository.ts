import type { Pool } from 'pg';
import type { HealthEventLog, HealthItemDefinition } from '@cuidat/shared';
import type { CalendarScope, EventRange, EventRepository, EventUpsertOutcome } from '../../domain/ports.js';
import { inTransaction, ITEM_COLUMNS, LOG_COLUMNS, toItem, toLog } from './rows.js';
import type { ItemRow, LogRow } from './rows.js';

export class PgEventRepository implements EventRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(scope: CalendarScope, range: EventRange): Promise<HealthEventLog[]> {
    const result = await this.pool.query<LogRow>(
      `SELECT ${LOG_COLUMNS}
       FROM health_event_logs l
       JOIN calendar_profiles p ON p.id = l.calendar_id
       WHERE p.user_id = $1 AND l.calendar_id = $2 AND l.logged_at >= $3 AND l.logged_at <= $4
       ORDER BY l.logged_at, l.created_at, l.id`,
      [scope.userId, scope.calendarId, range.from, range.to],
    );
    return result.rows.map(toLog);
  }

  async upsert(
    scope: CalendarScope,
    log: HealthEventLog,
    check: (item: HealthItemDefinition, existing: HealthEventLog | null) => HealthEventLog,
  ): Promise<EventUpsertOutcome> {
    return inTransaction(this.pool, async (client) => {
      // The id is global: a row of another calendar (or user) must never be touched.
      const stored = await client.query<LogRow>(`SELECT ${LOG_COLUMNS} FROM health_event_logs l WHERE l.id = $1 FOR UPDATE`, [log.id]);
      const existingRow = stored.rows[0];
      if (existingRow && existingRow.calendar_id !== scope.calendarId) {
        return { kind: 'conflict' };
      }
      const itemResult = await client.query<ItemRow>(
        `SELECT ${ITEM_COLUMNS}
         FROM health_item_definitions i
         JOIN calendar_profiles p ON p.id = i.calendar_id
         WHERE p.user_id = $1 AND i.calendar_id = $2 AND i.id = $3`,
        [scope.userId, scope.calendarId, log.itemDefinitionId],
      );
      const itemRow = itemResult.rows[0];
      if (!itemRow) {
        return { kind: 'item_not_found' };
      }
      const existing = existingRow ? toLog(existingRow) : null;
      if (existing && Date.parse(existing.updatedAt) >= Date.parse(log.updatedAt)) {
        return { kind: 'stale', log: existing };
      }
      const row = check(toItem(itemRow), existing);

      const saved = existing
        ? await client.query<LogRow>(
            `UPDATE health_event_logs l
             SET logged_at = $3, intensity = $4, duration_minutes = $5, notes = $6, updated_at = $7
             WHERE l.id = $1 AND l.calendar_id = $2
             RETURNING ${LOG_COLUMNS}`,
            [row.id, scope.calendarId, row.loggedAt, row.intensity, row.durationMinutes, row.notes, row.updatedAt],
          )
        : await client.query<LogRow>(
            `INSERT INTO health_event_logs AS l
               (id, calendar_id, item_definition_id, logged_at, intensity, duration_minutes, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING ${LOG_COLUMNS}`,
            [row.id, scope.calendarId, row.itemDefinitionId, row.loggedAt, row.intensity, row.durationMinutes, row.notes, row.createdAt, row.updatedAt],
          );
      return { kind: 'saved', log: toLog(saved.rows[0]!) };
    });
  }

  async remove(scope: CalendarScope, logId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM health_event_logs l USING calendar_profiles p
       WHERE p.id = l.calendar_id AND p.user_id = $1 AND l.calendar_id = $2 AND l.id = $3`,
      [scope.userId, scope.calendarId, logId],
    );
  }
}
