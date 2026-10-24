import { DomainRuleError, GUEST_LOCKED_WARNING, REPORTS_MAX_PER_USER } from '@cuidat/shared';
import type { ReportCreateBody, ReportSummary, SavedReport } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { ReportRepository } from '../ports/repositories';
import { sanitizeText } from '../sanitizeText';
import { currentRepositories } from './currentRepositories';

/**
 * Saved reports of the account (TECH_SPEC.md section 9.1). Only the metadata is kept in memory; a
 * report's snapshot is fetched when it is opened or downloaded.
 */
export const useReportStore = defineStore('reports', () => {
  const reports = ref<ReportSummary[]>([]);
  const loaded = ref(false);

  const isFull = computed(() => reports.value.length >= REPORTS_MAX_PER_USER);

  /** Guests have no reports (ADR-018): every action shows the locked warning. */
  function repository(): ReportRepository {
    const reportRepository = currentRepositories().reports;
    if (!reportRepository) {
      throw new DomainRuleError('GUEST_LIMIT', GUEST_LOCKED_WARNING);
    }
    return reportRepository;
  }

  async function loadReports(): Promise<void> {
    reports.value = await repository().list();
    loaded.value = true;
  }

  /** Loads the list once (for counts such as the calendar deletion warning). */
  async function ensureLoaded(): Promise<void> {
    if (!loaded.value && currentRepositories().reports) {
      await loadReports();
    }
  }

  async function createReport(body: ReportCreateBody): Promise<ReportSummary> {
    const title = body.title === undefined ? '' : sanitizeText(body.title).trim();
    const report = await repository().create({ ...body, title: title === '' ? undefined : title });
    reports.value = [report, ...reports.value];
    return report;
  }

  async function openReport(reportId: string): Promise<SavedReport> {
    return repository().get(reportId);
  }

  async function removeReport(reportId: string): Promise<void> {
    await repository().remove(reportId);
    reports.value = reports.value.filter((report) => report.id !== reportId);
  }

  /** Reports of one calendar (they are erased with it by cascade). */
  function countFor(calendarId: string): number {
    return reports.value.filter((report) => report.calendarId === calendarId).length;
  }

  /** The server erased them with their calendar: drop them from the list too. */
  function forgetCalendar(calendarId: string): void {
    reports.value = reports.value.filter((report) => report.calendarId !== calendarId);
  }

  function resetState(): void {
    reports.value = [];
    loaded.value = false;
  }

  return { reports, loaded, isFull, loadReports, ensureLoaded, createReport, openReport, removeReport, countFor, forgetCalendar, resetState };
});
