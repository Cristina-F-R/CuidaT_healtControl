import { describe, expect, it } from 'vitest';
import { isBeyondAllowedFuture, isValidTimeZone, monthsBetween, startOfZonedDay, zonedDateTime } from './time.js';

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

describe('local days in a time zone (reports)', () => {
  it('knows valid IANA zones only', () => {
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });

  it('gives the local day and time of an instant', () => {
    // 23:30 UTC is already the next day in Madrid (UTC+2 in summer).
    expect(zonedDateTime('2026-07-10T23:30:00.000Z', 'Europe/Madrid')).toEqual({ date: '2026-07-11', time: '01:30' });
    expect(zonedDateTime(Date.parse('2026-07-10T23:30:00.000Z'), 'UTC')).toEqual({ date: '2026-07-10', time: '23:30' });
  });

  it('finds the first instant of a local day, also on DST changes', () => {
    expect(new Date(startOfZonedDay('2026-07-11', 'Europe/Madrid')).toISOString()).toBe('2026-07-10T22:00:00.000Z');
    // Spring forward (29 March) and fall back (25 October): local midnight keeps that day's offset.
    expect(new Date(startOfZonedDay('2026-03-29', 'Europe/Madrid')).toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(new Date(startOfZonedDay('2026-03-30', 'Europe/Madrid')).toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(new Date(startOfZonedDay('2026-10-25', 'Europe/Madrid')).toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(new Date(startOfZonedDay('2026-10-26', 'Europe/Madrid')).toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(new Date(startOfZonedDay('2026-10-26', 'UTC')).toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('lists the months of a period, across a new year', () => {
    expect(monthsBetween('2026-11-15', '2027-02-01')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthsBetween('2026-10-01', '2026-10-31')).toEqual(['2026-10']);
  });
});
