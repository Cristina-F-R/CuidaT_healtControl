import type { DayMark, Intensity, ItemCategory, ReportItem, ReportItemStats, ReportLog, ReportSnapshot } from '@cuidat/shared';
import dayjs from 'dayjs';
import { buildSlots } from './composables/useCalendar';

// Wording of a saved report (TECH_SPEC.md section 9.1). The on-screen view and the PDF both use these
// helpers, so they always say the same; everything comes from the snapshot, never from the stores.

export const INTENSITY_LABELS: Record<Intensity, string> = { 1: 'Leve', 2: 'Moderada', 3: 'Grave' };
export const CATEGORY_LABELS: Record<ItemCategory, string> = { symptom: 'Síntoma', trigger: 'Trigger', medication: 'Medicación' };

function decimal(value: number): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
}

/** «3 de octubre de 2026» */
export function formatReportDate(date: string): string {
  return dayjs(date).format('D [de] MMMM [de] YYYY');
}

export function formatPeriod(from: string, to: string): string {
  return `Del ${formatReportDate(from)} al ${formatReportDate(to)}`;
}

/** Selected lineages by root id. */
export function reportItems(snapshot: ReportSnapshot): Map<string, ReportItem> {
  return new Map(snapshot.items.map((item) => [item.rootId, item]));
}

/** «Intensidad: Moderada · Duración: 20 min», or an empty string. */
export function logDetails(log: ReportLog): string {
  const parts: string[] = [];
  if (log.intensity !== null) {
    parts.push(`Intensidad: ${INTENSITY_LABELS[log.intensity]}`);
  }
  if (log.durationMinutes !== null) {
    parts.push(`Duración: ${log.durationMinutes} min`);
  }
  return parts.join(' · ');
}

/** Lines of the statistics of one item. */
export function statsDetails(stats: ReportItemStats): string[] {
  const lines = [`${stats.logCount} ${stats.logCount === 1 ? 'registro' : 'registros'}`];
  if (stats.intensityCounts && stats.intensityMean !== null) {
    const [mild, moderate, severe] = stats.intensityCounts;
    lines.push(`Intensidad media ${decimal(stats.intensityMean)} (leve ${mild} · moderada ${moderate} · grave ${severe})`);
  }
  if (stats.durationTotalMinutes !== null && stats.durationMeanMinutes !== null) {
    lines.push(`Duración total ${stats.durationTotalMinutes} min (media ${decimal(stats.durationMeanMinutes)} min)`);
  }
  return lines;
}

export interface MiniDay {
  date: string;
  day: number;
  mark: DayMark | null;
  symptoms: number;
  triggers: number;
  /** Outside the period the day is shown but empty. */
  inPeriod: boolean;
}

/** One month of the report as consultation mode shows it: marks and counts of the selected items. */
export function miniMonth(snapshot: ReportSnapshot, monthKey: string): (MiniDay | null)[] {
  const items = reportItems(snapshot);
  const days = new Map(snapshot.days.map((day) => [day.date, day]));
  return buildSlots(monthKey).map((date) => {
    if (!date) {
      return null;
    }
    const entry = days.get(date);
    const symptoms = entry?.logs.filter((log) => items.get(log.rootId)?.category === 'symptom').length ?? 0;
    return {
      date,
      day: dayjs(date).date(),
      mark: entry?.mark ?? null,
      symptoms,
      triggers: (entry?.logs.length ?? 0) - symptoms,
      inPeriod: date >= snapshot.period.from && date <= snapshot.period.to,
    };
  });
}

/** `cuidat-informe-{calendario}-{aaaa-mm-dd}.pdf`, with only safe characters. */
export function reportFileName(calendarName: string, createdAt: string): string {
  const slug = calendarName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `cuidat-informe-${slug || 'calendario'}-${dayjs(createdAt).format('YYYY-MM-DD')}.pdf`;
}
