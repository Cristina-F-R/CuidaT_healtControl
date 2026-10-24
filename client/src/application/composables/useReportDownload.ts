import type { SavedReport } from '@cuidat/shared';
import { downloadBlob } from '../../infrastructure/download';
import { reportFileName } from '../reportFormat';

/**
 * «Descargar PDF» of a saved report (TECH_SPEC.md section 9.1). The PDF module (pdfmake and the font)
 * is imported only now, so it never weighs on the first load.
 */
export async function downloadReportPdf(report: SavedReport): Promise<void> {
  const { renderReportPdf } = await import('../../infrastructure/pdf/reportPdf');
  downloadBlob(reportFileName(report.calendarName, report.createdAt), await renderReportPdf(report));
}
