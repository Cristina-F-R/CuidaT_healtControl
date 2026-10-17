import type { Pool, PoolClient } from 'pg';
import type { HealthItemDefinition, ItemStatus } from '@cuidat/shared';
import type { CalendarScope, ItemRepository } from '../../domain/ports.js';
import { inTransaction, insertItems, ITEM_COLUMNS, toItem } from './rows.js';
import type { ItemRow } from './rows.js';

// Every query reaches the items through calendar_profiles, filtered by the owner (TECH_SPEC.md section 7).
const OWNED_ITEMS = `FROM health_item_definitions i
  JOIN calendar_profiles p ON p.id = i.calendar_id
  WHERE p.user_id = $1 AND i.calendar_id = $2`;

async function ownsCalendar(client: PoolClient, scope: CalendarScope): Promise<boolean> {
  const result = await client.query('SELECT 1 FROM calendar_profiles WHERE id = $1 AND user_id = $2 FOR SHARE', [scope.calendarId, scope.userId]);
  return result.rowCount === 1;
}

/** Writes the difference between two versions of a lineage. Supersede first: one live version per root. */
async function writeLineageChange(client: PoolClient, before: readonly HealthItemDefinition[], after: readonly HealthItemDefinition[]): Promise<void> {
  const previous = new Map(before.map((item) => [item.id, item]));
  const changed = after.filter((item) => {
    const old = previous.get(item.id);
    return old !== undefined && (old.name !== item.name || old.emoji !== item.emoji || old.status !== item.status);
  });
  const ordered = [...changed].sort((a, b) => Number(b.status === 'superseded') - Number(a.status === 'superseded'));
  for (const item of ordered) {
    await client.query(
      'UPDATE health_item_definitions SET name = $1, emoji = $2, status = $3 WHERE id = $4 AND calendar_id = $5',
      [item.name, item.emoji, item.status, item.id, item.calendarId],
    );
  }
  await insertItems(client, after.filter((item) => !previous.has(item.id)));
}

export class PgItemRepository implements ItemRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(scope: CalendarScope, status?: ItemStatus): Promise<HealthItemDefinition[]> {
    const filter = status ? ' AND i.status = $3' : '';
    const result = await this.pool.query<ItemRow>(
      `SELECT ${ITEM_COLUMNS} ${OWNED_ITEMS}${filter} ORDER BY i.created_at, i.id`,
      status ? [scope.userId, scope.calendarId, status] : [scope.userId, scope.calendarId],
    );
    return result.rows.map(toItem);
  }

  async insert(scope: CalendarScope, items: readonly HealthItemDefinition[]): Promise<boolean> {
    return inTransaction(this.pool, async (client) => {
      if (!(await ownsCalendar(client, scope))) {
        return false;
      }
      await insertItems(client, items.map((item) => ({ ...item, calendarId: scope.calendarId })));
      return true;
    });
  }

  async updateLineage(
    scope: CalendarScope,
    rootId: string,
    change: (lineage: HealthItemDefinition[]) => HealthItemDefinition[],
  ): Promise<HealthItemDefinition[] | null> {
    return inTransaction(this.pool, async (client) => {
      const locked = await client.query<ItemRow>(
        `SELECT ${ITEM_COLUMNS} ${OWNED_ITEMS} AND i.root_id = $3 ORDER BY i.created_at, i.id FOR UPDATE OF i`,
        [scope.userId, scope.calendarId, rootId],
      );
      if (locked.rows.length === 0) {
        return null;
      }
      const before = locked.rows.map(toItem);
      const after = change(before).filter((item) => item.rootId === rootId && item.calendarId === scope.calendarId);
      await writeLineageChange(client, before, after);
      return after;
    });
  }

  async countLineageLogs(scope: CalendarScope, rootId: string): Promise<number | null> {
    const result = await this.pool.query<{ versions: string; logs: string }>(
      `SELECT count(DISTINCT i.id) AS versions, count(l.id) AS logs
       FROM health_item_definitions i
       JOIN calendar_profiles p ON p.id = i.calendar_id
       LEFT JOIN health_event_logs l ON l.item_definition_id = i.id AND l.calendar_id = i.calendar_id
       WHERE p.user_id = $1 AND i.calendar_id = $2 AND i.root_id = $3`,
      [scope.userId, scope.calendarId, rootId],
    );
    const row = result.rows[0];
    return row && Number(row.versions) > 0 ? Number(row.logs) : null;
  }

  async removeLineage(scope: CalendarScope, rootId: string): Promise<void> {
    // Deleting the root removes every version (fk_item_root) and their logs (fk_logs_item_calendar).
    await this.pool.query(
      `DELETE FROM health_item_definitions i USING calendar_profiles p
       WHERE p.id = i.calendar_id AND p.user_id = $1 AND i.calendar_id = $2 AND i.id = $3 AND i.root_id = $3`,
      [scope.userId, scope.calendarId, rootId],
    );
  }
}
