import type { SavedReport } from '@cuidat/shared';
import type * as PdfMakeModule from 'pdfmake/build/pdfmake';
import boldFontUrl from '@fontsource/nunito-sans/files/nunito-sans-latin-800-normal.woff?url';
import regularFontUrl from '@fontsource/nunito-sans/files/nunito-sans-latin-400-normal.woff?url';
import { renderEmojiImages } from './emojiImages';
import { buildReportDocument, PDF_FONT } from './reportDocument';

// Renders a saved report as a PDF in the browser (TECH_SPEC.md section 9.1, ADR-022): no health data
// leaves the device. This module is loaded on demand, so pdfmake and the font files stay out of the
// initial bundle and of the PWA precache. Nunito Sans (SIL OFL) is served from our own origin, as the
// CSP only allows same-origin resources.

type PdfMake = typeof PdfMakeModule;

let ready: Promise<PdfMake> | null = null;

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // In chunks: String.fromCharCode cannot take a whole font file as arguments.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function fontFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la fuente del informe (${response.status}).`);
  }
  return toBase64(await response.arrayBuffer());
}

/** pdfmake with the CuidaT font registered, loaded once. */
function loadPdfMake(): Promise<PdfMake> {
  ready ??= (async () => {
    const [module, regular, bold] = await Promise.all([
      import('pdfmake/build/pdfmake') as Promise<PdfMake & { default?: PdfMake }>,
      fontFile(regularFontUrl),
      fontFile(boldFontUrl),
    ]);
    const pdfMake = module.default ?? module;
    pdfMake.addVirtualFileSystem({ 'NunitoSans-Regular.woff': regular, 'NunitoSans-Bold.woff': bold });
    pdfMake.setFonts({
      [PDF_FONT]: {
        normal: 'NunitoSans-Regular.woff',
        bold: 'NunitoSans-Bold.woff',
        italics: 'NunitoSans-Regular.woff',
        bolditalics: 'NunitoSans-Bold.woff',
      },
    });
    return pdfMake;
  })().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

export async function renderReportPdf(report: SavedReport): Promise<Blob> {
  const pdfMake = await loadPdfMake();
  const emojis = renderEmojiImages(report.snapshot.items.map((item) => item.emoji));
  return pdfMake.createPdf(buildReportDocument(report, emojis)).getBlob();
}
