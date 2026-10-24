import { reportsResponseSchema, reportSummaryResponseSchema, savedReportResponseSchema } from '@cuidat/shared';
import type { ReportCreateBody, ReportSummary, SavedReport } from '@cuidat/shared';
import type { ReportRepository } from '../../application/ports/repositories';
import { apiRequest } from '../http/apiClient';

/**
 * Saved reports of the signed-in user (TECH_SPEC.md section 9.1). Online only: they are never kept in
 * the offline cache, and every answer is validated before it reaches the UI.
 */
export class ApiReportRepository implements ReportRepository {
  async list(): Promise<ReportSummary[]> {
    return reportsResponseSchema.parse(await apiRequest('GET', '/reports')).reports;
  }

  async get(reportId: string): Promise<SavedReport> {
    return savedReportResponseSchema.parse(await apiRequest('GET', `/reports/${reportId}`)).report;
  }

  async create(body: ReportCreateBody): Promise<ReportSummary> {
    return reportSummaryResponseSchema.parse(await apiRequest('POST', '/reports', body)).report;
  }

  async remove(reportId: string): Promise<void> {
    await apiRequest('DELETE', `/reports/${reportId}`);
  }
}
