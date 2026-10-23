/**
 * Downloads `data` as a JSON file built in the browser (GDPR Art. 20). Nothing is uploaded: the
 * object URL lives only for the click and is revoked right after.
 */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
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
