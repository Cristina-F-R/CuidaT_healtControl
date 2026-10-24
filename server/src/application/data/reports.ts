import { buildReportSnapshot, REPORT_SNAPSHOT_MAX_BYTES, REPORTS_MAX_PER_USER, reportRange, zonedDateTime } from '@cuidat/shared';
import type { ReportCreateBody, ReportSummary, SavedReport } from '@cuidat/shared';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../domain/errors.js';
import type { NewReport } from '../../domain/ports.js';
import type { DataDependencies } from './dataDependencies.js';

// Saved reports (TECH_SPEC.md section 9.1, ADR-022): the client sends parameters only; the server loads
// the data through the user-scoped repositories and builds the snapshot with the shared engine.

const REPORT_NOT_FOUND = 'El informe no existe.';
const CALENDAR_NOT_FOUND = 'El calendario no existe.';

export async function listReports(deps: DataDependencies, userId: string): Promise<ReportSummary[]> {
  return deps.reports.list(userId);
}

export async function getReport(deps: DataDependencies, userId: string, reportId: string): Promise<SavedReport> {
  const report = await deps.reports.find(userId, reportId);
  if (!report) {
    throw new NotFoundError(REPORT_NOT_FOUND);
  }
  return report;
}

export async function createReport(deps: DataDependencies, userId: string, body: ReportCreateBody): Promise<ReportSummary> {
  const scope = { userId, calendarId: body.calendarId };
  const profile = await deps.profiles.find(userId, body.calendarId);
  if (!profile) {
    throw new NotFoundError(CALENDAR_NOT_FOUND);
  }
  const now = deps.clock();
  // Future dates are blocked for everyone (TECH_SPEC.md use case 8), in the user's own calendar day.
  if (body.to > zonedDateTime(now.getTime(), body.timeZone).date) {
    throw new ValidationError('El periodo no puede incluir días futuros.', 'REPORT_FUTURE_PERIOD');
  }

  const [items, logs] = await Promise.all([
    deps.items.list(scope),
    deps.events.list(scope, reportRange(body.from, body.to, body.timeZone, profile.correlationWindowHours)),
  ]);
  const snapshot = buildReportSnapshot({
    profile,
    items,
    logs,
    from: body.from,
    to: body.to,
    timeZone: body.timeZone,
    symptomRootIds: body.symptomRootIds,
    triggerRootIds: body.triggerRootIds,
    generatedAt: now.toISOString(),
  });
  if (Buffer.byteLength(JSON.stringify(snapshot), 'utf8') > REPORT_SNAPSHOT_MAX_BYTES) {
    throw new AppError(413, 'REPORT_TOO_LARGE', 'El informe es demasiado grande. Elige un periodo más corto o menos ítems.');
  }

  const report: NewReport = {
    id: deps.newId(),
    calendarId: profile.id,
    title: body.title ?? `Informe de ${profile.name}`,
    periodFrom: body.from,
    periodTo: body.to,
    snapshot,
    createdAt: now.toISOString(),
  };
  const outcome = await deps.reports.insertWithinLimit(userId, report, REPORTS_MAX_PER_USER);
  if (outcome === 'limit') {
    throw new ConflictError(`Has alcanzado el máximo de ${REPORTS_MAX_PER_USER} informes. Elimina uno para guardar otro.`, 'REPORT_LIMIT');
  }
  if (outcome === 'calendar_not_found') {
    throw new NotFoundError(CALENDAR_NOT_FOUND);
  }
  return {
    id: report.id,
    calendarId: report.calendarId,
    calendarName: profile.name,
    title: report.title,
    periodFrom: report.periodFrom,
    periodTo: report.periodTo,
    createdAt: report.createdAt,
  };
}

export async function deleteReport(deps: DataDependencies, userId: string, reportId: string): Promise<void> {
  if (!(await deps.reports.remove(userId, reportId))) {
    throw new NotFoundError(REPORT_NOT_FOUND);
  }
}
