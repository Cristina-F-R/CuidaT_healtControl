import { describe, expect, it } from 'vitest';
import { sanitizeText } from './sanitizeText';

describe('sanitizeText', () => {
  it('keeps plain text and trims it', () => {
    expect(sanitizeText('  Malestar leve  ')).toBe('Malestar leve');
  });

  it('removes tags and keeps their text', () => {
    expect(sanitizeText('<b>Vómito</b> tras comer')).toBe('Vómito tras comer');
  });

  it('drops scripts and event handlers', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>Tos')).toBe('Tos');
    expect(sanitizeText('ok<script>alert(1)</script>')).toBe('ok');
  });

  it('stores ampersands and comparison signs as they were typed', () => {
    expect(sanitizeText('Malestar & dolor')).toBe('Malestar & dolor');
    expect(sanitizeText('menos < más')).toBe('menos < más');
    expect(sanitizeText('2 > 1 & 3 < 4')).toBe('2 > 1 & 3 < 4');
  });
});
