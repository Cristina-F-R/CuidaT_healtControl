import type { DayMark, ReportItem, SavedReport } from '@cuidat/shared';
import dayjs from 'dayjs';
import type { Column, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { monthLabelOf } from '../../application/composables/useCalendar';
import {
  CATEGORY_LABELS,
  formatPeriod,
  formatReportDate,
  logDetails,
  miniMonth,
  reportItems,
  statsDetails,
} from '../../application/reportFormat';
import { PALETTE } from '../../theme/palette';

// Layout of the PDF of a saved report (TECH_SPEC.md section 9.1): the same content and order as the
// on-screen view, built only from the snapshot. The font (latin subset) has no emoji nor arrows: emojis
// come as PNG images drawn by the browser (`emojiImages`, see emojiImages.ts), with the item's initial
// as fallback, and a pattern reads «Pescado, seguido de Vómito».

export const PDF_FONT = 'NunitoSans';

/** PNG data URLs by emoji. */
export type EmojiImages = ReadonlyMap<string, string>;

const MARK_FILL: Record<DayMark, string> = { watch: PALETTE.sun, detected: PALETTE.peach };
const MARK_LABEL: Record<DayMark, string> = { watch: 'Vigilar posible patrón', detected: 'Patrón detectado' };
const MARK_LETTER: Record<DayMark, string> = { watch: 'V', detected: 'D' };
const MARKS: readonly DayMark[] = ['detected', 'watch'];
const THEME_FILL: Record<SavedReport['snapshot']['calendar']['colorTheme'], string> = {
  slate: PALETTE.slate[300],
  peach: PALETTE.peach,
  sky: PALETTE.sky,
  mint: PALETTE.mint,
};
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ICONS_PER_ROW = 5;

function heading(text: string): Content {
  return { text, style: 'heading' };
}

/** The item's emoji as an image, or its initial when the browser could not draw it. */
function itemIcon(item: ReportItem | undefined, images: EmojiImages, size: number): Column {
  const image = item ? images.get(item.emoji) : undefined;
  return image
    ? { image, width: size, height: size }
    : { text: item?.name.charAt(0).toUpperCase() ?? '?', bold: true, fontSize: size * 0.75, width: size };
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    rows.push(values.slice(index, index + size));
  }
  return rows;
}

/** Colored box of one threshold: its patterns, or a line saying there is none (like the screen). */
function patternBox(report: SavedReport, mark: DayMark): Content {
  const items = reportItems(report.snapshot);
  const patterns = report.snapshot.patterns.filter((pattern) => pattern.category === MARK_LABEL[mark]);
  const rows: TableCell[][] = patterns.length === 0
    ? [[{ text: 'Ninguno en este periodo.', colSpan: 2 }, {}]]
    : patterns.map((pattern) => [
        { text: `${items.get(pattern.triggerRootId)?.name ?? '—'}, seguido de ${items.get(pattern.symptomRootId)?.name ?? '—'}`, bold: true },
        { text: `${pattern.occurrences} coincidencias`, alignment: 'right' },
      ]);
  return [
    { text: MARK_LABEL[mark], style: 'subheading' },
    {
      table: { widths: ['*', 'auto'], body: rows },
      layout: { fillColor: () => MARK_FILL[mark], hLineColor: () => PALETTE.canvas, vLineWidth: () => 0, hLineWidth: () => 2, paddingTop: () => 5, paddingBottom: () => 5 },
      margin: [0, 0, 0, 6],
    },
  ];
}

function statsTable(report: SavedReport, images: EmojiImages): Content {
  const items = reportItems(report.snapshot);
  const header: TableCell[] = ['Ítem', 'Tipo', 'Resumen'].map((text) => ({ text, style: 'tableHeader' }));
  return {
    table: {
      headerRows: 1,
      widths: ['auto', 'auto', '*'],
      body: [
        header,
        ...report.snapshot.itemStats.map((stats): TableCell[] => {
          const item = items.get(stats.rootId);
          return [
            { columns: [itemIcon(item, images, 11), { text: `${item?.name ?? '—'}${item?.archived ? ' (archivado)' : ''}`, bold: true, width: 'auto' }], columnGap: 4 },
            item ? CATEGORY_LABELS[item.category] : '—',
            statsDetails(stats).join('\n'),
          ];
        }),
      ],
    },
    layout: 'lightHorizontalLines',
  };
}

/** Which icon means which item, and what the day letters mean. */
function calendarLegend(report: SavedReport, images: EmojiImages): Content {
  const entries = report.snapshot.items.map((item): TableCell => ({
    columns: [itemIcon(item, images, 10), { text: item.name, width: '*' }],
    columnGap: 4,
  }));
  const rows = chunk(entries, 3).map((row) => [...row, ...Array<TableCell>(3 - row.length).fill({ text: '' })]);
  return [
    { text: 'Cada icono es un registro de ese ítem. V: día con «Vigilar posible patrón». D: día con «Patrón detectado».', style: 'muted', margin: [0, 0, 0, 4] },
    { table: { widths: ['*', '*', '*'], body: rows }, layout: 'noBorders', margin: [0, 0, 0, 8] },
  ];
}

function monthTable(report: SavedReport, monthKey: string, images: EmojiImages): Content {
  const items = reportItems(report.snapshot);
  const days = new Map(report.snapshot.days.map((day) => [day.date, day]));
  const cells = miniMonth(report.snapshot, monthKey).map((slot): TableCell => {
    if (!slot) {
      return { text: '' };
    }
    const icons = (days.get(slot.date)?.logs ?? []).map((log) => itemIcon(items.get(log.rootId), images, 9));
    return {
      stack: [
        { text: `${slot.day}${slot.mark ? ` ${MARK_LETTER[slot.mark]}` : ''}`, bold: true },
        ...chunk(icons, ICONS_PER_ROW).map((row): Content => ({ columns: row, columnGap: 1.5, margin: [0, 1.5, 0, 0] })),
      ],
      fillColor: slot.mark ? MARK_FILL[slot.mark] : slot.inPeriod ? PALETTE.canvas : PALETTE.slate[50],
      color: slot.inPeriod ? PALETTE.slate[800] : PALETTE.slate[400],
    };
  });
  // Title and grid in one unbreakable block: a month never starts on one page and ends on the next.
  return {
    stack: [
      { text: monthLabelOf(monthKey), style: 'subheading' },
      {
        table: { widths: Array<string>(7).fill('*'), heights: 30, body: [WEEKDAYS.map((text) => ({ text, style: 'tableHeader' })), ...chunk(cells, 7)] },
        layout: { hLineColor: () => PALETTE.slate[200], vLineColor: () => PALETTE.slate[200] },
        fontSize: 8,
      },
    ],
    unbreakable: true,
    margin: [0, 0, 0, 8],
  };
}

function dayList(report: SavedReport): Content[] {
  const items = reportItems(report.snapshot);
  if (report.snapshot.days.length === 0) {
    return [{ text: 'No hay registros de los ítems elegidos en este periodo.', style: 'muted' }];
  }
  return report.snapshot.days.flatMap((day): Content[] => [
    {
      text: `${formatReportDate(day.date)}${day.mark ? ` · ${MARK_LABEL[day.mark]}` : ''}`,
      style: 'subheading',
      background: day.mark ? MARK_FILL[day.mark] : undefined,
    },
    {
      ul: day.logs.map((log) => {
        const item = items.get(log.rootId);
        const details = logDetails(log);
        return {
          text: [
            { text: `${log.time} · ${item?.name ?? '—'}`, bold: true },
            ` (${item ? CATEGORY_LABELS[item.category] : '—'})`,
            details ? ` — ${details}` : '',
            log.notes ? { text: `\nNotas: ${log.notes}`, color: PALETTE.slate[600] } : '',
          ],
        };
      }),
      margin: [0, 0, 0, 6],
    },
  ]);
}

/** pdfmake definition of a saved report. */
export function buildReportDocument(report: SavedReport, images: EmojiImages = new Map()): TDocumentDefinitions {
  const { snapshot } = report;
  const { calendar } = snapshot;
  return {
    info: { title: report.title, creator: 'CuidaT' },
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 56],
    defaultStyle: { font: PDF_FONT, fontSize: 9.5, color: PALETTE.slate[800], lineHeight: 1.2 },
    styles: {
      title: { fontSize: 18, bold: true, color: PALETTE.slate[800] },
      heading: { fontSize: 12, bold: true, margin: [0, 14, 0, 6], color: PALETTE.slate.DEFAULT },
      subheading: { fontSize: 10, bold: true, margin: [0, 6, 0, 3] },
      tableHeader: { bold: true, fontSize: 8, color: PALETTE.slate.DEFAULT },
      muted: { color: PALETTE.slate[600] },
    },
    footer: (page, pages) => ({
      columns: [
        { text: 'Una coincidencia no confirma una causa. Coméntala con un profesional.', style: 'muted', fontSize: 7.5 },
        { text: `CuidaT · Página ${page} de ${pages}`, alignment: 'right', fontSize: 7.5, style: 'muted' },
      ],
      margin: [40, 16, 40, 0],
    }),
    content: [
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 515, h: 6, color: THEME_FILL[calendar.colorTheme] }], margin: [0, 0, 0, 10] },
      { text: report.title, style: 'title' },
      { text: `${calendar.name} · ${calendar.profileType}`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] },
      { text: formatPeriod(snapshot.period.from, snapshot.period.to) },
      { text: `Ventana de correlación: ${calendar.correlationWindowHours} horas` },
      { text: `Generado el ${dayjs(snapshot.generatedAt).format('D [de] MMMM [de] YYYY [a las] HH:mm')}`, style: 'muted' },
      heading('Patrones'),
      ...MARKS.map((mark) => patternBox(report, mark)),
      heading('Resumen por ítem'),
      statsTable(report, images),
      heading('Calendarios'),
      calendarLegend(report, images),
      ...snapshot.months.map((monthKey) => monthTable(report, monthKey, images)),
      heading('Registros día a día'),
      ...dayList(report),
    ],
  };
}
