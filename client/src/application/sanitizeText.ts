import DOMPurify from 'dompurify';

/**
 * Removes markup from user text before it reaches the store (OWASP A03, STYLE_GUIDE.md section 6).
 * DOMPurify returns a DOM fragment with only text nodes, so no HTML string is produced and no
 * entities need decoding. Vue interpolation escapes the text again on render.
 */
export function sanitizeText(raw: string): string {
  const fragment = DOMPurify.sanitize(raw.trim(), { ALLOWED_TAGS: [], KEEP_CONTENT: true, RETURN_DOM_FRAGMENT: true });
  return fragment.textContent ?? '';
}
