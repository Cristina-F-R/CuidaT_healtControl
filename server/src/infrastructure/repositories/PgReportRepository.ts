import type { Pool } from 'pg';
import type { ReportSnapshot, ReportSummary, SavedReport } from '@cuidat/shared';
import type { NewReport, ReportRepository } from '../../domain/ports.js';
import { inTransaction } from './rows.js';

interface ReportRow {
  id: string;
  calendar_id: string;
  calendar_name: string;
  title: string;
  period_from: string;
  period_to: string;
  created_at: Date;
  snapshot?: ReportSnapshot;
}

// DATE columns are read as text: the pg driver would otherwise turn them into a Date at local midnight.
const SUMMARY_COLUMNS = `r.id, r.calendar_id, p.name AS calendar_name, r.title, r.period_from::text AS period_from,
  r.period_to::text AS period_to, r.created_at`;

function toSummary(row: ReportRow): ReportSummary {
  return {
    id: row.id,
    calendarId: row.calendar_id,
    calendarName: row.calendar_name,
    title: row.title,
    periodFrom: row.period_from,
    periodTo: row.period_to,
    createdAt: row.created_at.toISOString(),
  };
}

/** Saved reports (TECH_SPEC.md section 9.1). Every query joins calendar_profiles on the user. */
export class PgReportRepository implements ReportRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async list(userId: string): Promise<ReportSummary[]> {
    const result = await this.pool.query<ReportRow>(
      `SELECT ${SUMMARY_COLUMNS}
       FROM health_reports r
       JOIN calendar_profiles p ON p.id = r.calendar_id
       WHERE p.user_id = $1
       ORDER BY r.created_at DESC, r.id`,
      [userId],
    );
    return result.rows.map(toSummary);
  }

  async find(userId: string, reportId: string): Promise<SavedReport | null> {
    const result = await this.pool.query<ReportRow>(
      `SELECT ${SUMMARY_COLUMNS}, r.snapshot
       FROM health_reports r
       JOIN calendar_profiles p ON p.id = r.calendar_id
       WHERE p.user_id = $1 AND r.id = $2`,
      [userId, reportId],
    );
    const row = result.rows[0];
    return row?.snapshot ? { ...toSummary(row), snapshot: row.snapshot } : null;
  }

  async insertWithinLimit(userId: string, report: NewReport, limit: number): Promise<'created' | 'limit' | 'calendar_not_found'> {
    return inTransaction(this.pool, async (client) => {
      // Serializes the report creations of this user: the count below cannot go stale.
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const calendar = await client.query('SELECT 1 FROM calendar_profiles WHERE id = $1 AND user_id = $2', [report.calendarId, userId]);
      if (calendar.rowCount === 0) {
        return 'calendar_not_found';
      }
      const counted = await client.query<{ total: number }>(
        `SELECT count(*)::int AS total
         FROM health_reports r
         JOIN calendar_profiles p ON p.id = r.calendar_id
         WHERE p.user_id = $1`,
        [userId],
      );
      if ((counted.rows[0]?.total ?? 0) >= limit) {
        return 'limit';
      }
      await client.query(
        `INSERT INTO health_reports (id, calendar_id, title, period_from, period_to, snapshot, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [report.id, report.calendarId, report.title, report.periodFrom, report.periodTo, JSON.stringify(report.snapshot), report.createdAt],
      );
      return 'created';
    });
  }

  async remove(userId: string, reportId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM health_reports r
       USING calendar_profiles p
       WHERE r.id = $2 AND p.id = r.calendar_id AND p.user_id = $1`,
      [userId, reportId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
