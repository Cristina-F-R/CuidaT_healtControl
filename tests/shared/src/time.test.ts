import { describe, expect, it } from 'vitest';
import { isBeyondAllowedFuture } from './time.js';

const NOW = new Date('2026-04-20T10:00:00.000Z');

describe('isBeyondAllowedFuture', () => {
  it('allows past instants and the current instant', () => {
    expect(isBeyondAllowedFuture('2026-04-19T23:00:00.000Z', NOW)).toBe(false);
    expect(isBeyondAllowedFuture(NOW, NOW)).toBe(false);
  });

  it('tolerates clock skew up to the tolerance (inclusive)', () => {
    expect(isBeyondAllowedFuture('2026-04-20T10:05:00.000Z', NOW)).toBe(false);
    expect(isBeyondAllowedFuture('2026-04-20T10:05:00.001Z', NOW)).toBe(true);
  });

  it('rejects future instants and honours a custom tolerance', () => {
    expect(isBeyondAllowedFuture('2026-04-21T08:00:00.000Z', NOW)).toBe(true);
    expect(isBeyondAllowedFuture('2026-04-20T10:03:00.000Z', NOW, 0)).toBe(true);
  });

  it('rejects unparseable values', () => {
    expect(isBeyondAllowedFuture('not-a-date', NOW)).toBe(true);
  });
});
