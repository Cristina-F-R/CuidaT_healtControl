import { DomainRuleError } from './errors.js';

/** Trims and checks the length in characters (code points), matching the SQL `VARCHAR(n)` limits. */
export function requireText(value: string, label: string, maxLength: number): string {
  const text = value.trim();
  if (text.length === 0 || [...text].length > maxLength) {
    throw new DomainRuleError('INVALID_INPUT', `${label} debe tener entre 1 y ${maxLength} caracteres.`);
  }
  return text;
}
