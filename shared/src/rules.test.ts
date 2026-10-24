import { describe, expect, it } from 'vitest';
import { GUEST_MAX_SYMPTOMS, GUEST_MAX_TRIGGERS } from './constants.js';
import { DomainRuleError } from './errors.js';
import { isGuestItemLimitReached, isGuestProfileLimitReached } from './guestLimits.js';
import { createCalendarProfile } from './profiles.js';
import { validateEventLogFields } from './events.js';
import type { CalendarProfile, HealthItemDefinition } from './types.js';

const NOW = new Date('2026-04-20T10:00:00.000Z');

function ruleCodeOf(action: () => unknown): string {
  try {
    action();
    return 'none';
  } catch (error) {
    return error instanceof DomainRuleError ? error.code : 'unexpected';
  }
}

const SYMPTOM: HealthItemDefinition = {
  id: 'vomit',
  calendarId: 'cal-1',
  rootId: 'vomit',
  parentId: null,
  name: 'Vómito',
  emoji: '🤢',
  category: 'symptom',
  trackIntensity: true,
  trackDuration: false,
  status: 'active',
  createdAt: NOW.toISOString(),
};

const FIELDS = {
  loggedAt: '2026-04-20T09:00:00.000Z',
  intensity: 2 as const,
  durationMinutes: null,
  notes: null,
};

describe('validateEventLogFields', () => {
  it('accepts a valid log and normalises empty notes to null', () => {
    const result = validateEventLogFields(SYMPTOM, { ...FIELDS, notes: '   ' }, { isNew: true, now: NOW });
    expect(result).toEqual({ ...FIELDS, notes: null });
    const withNotes = validateEventLogFields(SYMPTOM, { ...FIELDS, notes: ' Tras comer ' }, { isNew: true, now: NOW });
    expect(withNotes.notes).toBe('Tras comer');
  });

  it('rejects new logs on archived items but still accepts edits of existing logs', () => {
    const archived = { ...SYMPTOM, status: 'archived' as const };
    expect(ruleCodeOf(() => validateEventLogFields(archived, FIELDS, { isNew: true, now: NOW }))).toBe('ITEM_NOT_ACTIVE');
    expect(ruleCodeOf(() => validateEventLogFields(archived, FIELDS, { isNew: false, now: NOW }))).toBe('none');
  });

  it('rejects unparseable and future instants (tolerance of 5 minutes)', () => {
    expect(ruleCodeOf(() => validateEventLogFields(SYMPTOM, { ...FIELDS, loggedAt: 'nope' }, { isNew: true, now: NOW }))).toBe(
      'INVALID_INPUT',
    );
    expect(
      ruleCodeOf(() =>
        validateEventLogFields(SYMPTOM, { ...FIELDS, loggedAt: '2026-04-20T10:06:00.000Z' }, { isNew: true, now: NOW }),
      ),
    ).toBe('FUTURE_DATE');
  });

  it('accepts metrics only when the item version records them', () => {
    const noIntensity = { ...SYMPTOM, trackIntensity: false };
    expect(ruleCodeOf(() => validateEventLogFields(noIntensity, FIELDS, { isNew: true, now: NOW }))).toBe('INVALID_INPUT');

    const noDuration = { ...SYMPTOM, trackDuration: false };
    const withDuration = { ...FIELDS, intensity: null, durationMinutes: 30 };
    expect(ruleCodeOf(() => validateEventLogFields(noDuration, withDuration, { isNew: true, now: NOW }))).toBe('INVALID_INPUT');
    expect(
      ruleCodeOf(() => validateEventLogFields({ ...SYMPTOM, trackDuration: true }, withDuration, { isNew: true, now: NOW })),
    ).toBe('none');
  });

  it('checks intensity and duration ranges and notes length', () => {
    const duration = { ...SYMPTOM, trackDuration: true };
    const withIntensity = (intensity: number): unknown => ({ ...FIELDS, intensity: intensity as 1 });
    expect(ruleCodeOf(() => validateEventLogFields(SYMPTOM, withIntensity(4), { isNew: true, now: NOW }))).toBe('INVALID_INPUT');
    for (const minutes of [0, 1441, 1.5]) {
      expect(
        ruleCodeOf(() =>
          validateEventLogFields(duration, { ...FIELDS, intensity: null, durationMinutes: minutes }, { isNew: true, now: NOW }),
        ),
      ).toBe('INVALID_INPUT');
    }
    expect(
      ruleCodeOf(() =>
        validateEventLogFields(SYMPTOM, { ...FIELDS, notes: 'a'.repeat(301) }, { isNew: true, now: NOW }),
      ),
    ).toBe('INVALID_INPUT');
  });
});

describe('createCalendarProfile', () => {
  it('applies the defaults and the allowed correlation windows', () => {
    const profile = createCalendarProfile({ name: 'Moby', profileType: 'Mascota' }, 'p1', NOW.toISOString());
    expect(profile).toEqual({
      id: 'p1',
      name: 'Moby',
      profileType: 'Mascota',
      avatarIcon: '👤',
      colorTheme: 'slate',
      correlationWindowHours: 48,
      createdAt: NOW.toISOString(),
    });
    expect(
      createCalendarProfile({ name: 'Luna', profileType: 'Adulto', correlationWindowHours: 2 }, 'p2', NOW.toISOString())
        .correlationWindowHours,
    ).toBe(2);
  });

  it('rejects windows outside the allowed list and empty names or types', () => {
    const invalid = { name: 'Moby', profileType: 'Mascota', correlationWindowHours: 7 as 2 };
    expect(ruleCodeOf(() => createCalendarProfile(invalid, 'p', NOW.toISOString()))).toBe('INVALID_INPUT');
    expect(ruleCodeOf(() => createCalendarProfile({ name: ' ', profileType: 'x' }, 'p', NOW.toISOString()))).toBe('INVALID_INPUT');
    expect(ruleCodeOf(() => createCalendarProfile({ name: 'x', profileType: 'y'.repeat(51) }, 'p', NOW.toISOString()))).toBe(
      'INVALID_INPUT',
    );
  });

  it('accepts only the color themes of the palette', () => {
    expect(createCalendarProfile({ name: 'Luna', profileType: 'Adulto', colorTheme: 'mint' }, 'p', NOW.toISOString()).colorTheme).toBe('mint');
    expect(ruleCodeOf(() => createCalendarProfile({ name: 'Luna', profileType: 'Adulto', colorTheme: 'red' as 'slate' }, 'p', NOW.toISOString()))).toBe(
      'INVALID_INPUT',
    );
  });
});

describe('guest limits', () => {
  function items(count: number, category: HealthItemDefinition['category'], status: HealthItemDefinition['status'] = 'active'): HealthItemDefinition[] {
    return Array.from({ length: count }, (_, index) => ({ ...SYMPTOM, id: `${category}-${index}`, rootId: `${category}-${index}`, category, status }));
  }

  it('counts symptoms and triggers/medication separately, one slot per live version', () => {
    expect(isGuestItemLimitReached(items(GUEST_MAX_SYMPTOMS - 1, 'symptom'), 'cal-1', 'symptom')).toBe(false);
    expect(isGuestItemLimitReached(items(GUEST_MAX_SYMPTOMS, 'symptom'), 'cal-1', 'symptom')).toBe(true);
    expect(isGuestItemLimitReached(items(GUEST_MAX_TRIGGERS, 'trigger'), 'cal-1', 'medication')).toBe(true);
    expect(isGuestItemLimitReached(items(GUEST_MAX_TRIGGERS, 'trigger'), 'cal-1', 'symptom')).toBe(false);
  });

  it('ignores superseded rows and other calendars, but counts archived items', () => {
    const superseded = items(GUEST_MAX_SYMPTOMS, 'symptom', 'superseded');
    expect(isGuestItemLimitReached(superseded, 'cal-1', 'symptom')).toBe(false);
    expect(isGuestItemLimitReached(items(GUEST_MAX_SYMPTOMS, 'symptom'), 'other-cal', 'symptom')).toBe(false);
    expect(isGuestItemLimitReached(items(GUEST_MAX_SYMPTOMS, 'symptom', 'archived'), 'cal-1', 'symptom')).toBe(true);
  });

  it('allows a single calendar profile', () => {
    const profile: CalendarProfile = createCalendarProfile({ name: 'Moby', profileType: 'Mascota' }, 'p1', NOW.toISOString());
    expect(isGuestProfileLimitReached([])).toBe(false);
    expect(isGuestProfileLimitReached([profile])).toBe(true);
  });
});
