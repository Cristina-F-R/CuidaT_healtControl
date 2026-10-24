/**
 * Downloads a file built in the browser: nothing is uploaded, and the object URL lives only for the
 * click and is revoked right after (STYLE_GUIDE.md, GDPR Art. 20).
 */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downloads `data` as a JSON file (GDPR Art. 20, «Descargar mis datos»). */
export function downloadJson(fileName: string, data: unknown): void {
  downloadBlob(fileName, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
