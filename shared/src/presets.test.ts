import { describe, expect, it } from 'vitest';
import { GUEST_MAX_SYMPTOMS, GUEST_MAX_TRIGGERS } from './constants.js';
import { createPresetItems, PRESET_ITEMS } from './presets.js';

describe('PRESET_ITEMS', () => {
  it('fits exactly in the guest limits (3 symptoms + 3 triggers/medication)', () => {
    const symptoms = PRESET_ITEMS.filter((item) => item.category === 'symptom');
    expect(symptoms).toHaveLength(GUEST_MAX_SYMPTOMS);
    expect(PRESET_ITEMS.length - symptoms.length).toBe(GUEST_MAX_TRIGGERS);
  });
});

describe('createPresetItems', () => {
  it('creates active original versions linked to the calendar', () => {
    let counter = 0;
    const now = new Date('2026-04-20T10:00:00.000Z');
    const items = createPresetItems('calendar-1', () => `id-${++counter}`, now);

    expect(items).toHaveLength(PRESET_ITEMS.length);
    for (const item of items) {
      expect(item.calendarId).toBe('calendar-1');
      expect(item.rootId).toBe(item.id);
      expect(item.parentId).toBeNull();
      expect(item.status).toBe('active');
      expect(item.createdAt).toBe(now.toISOString());
    }
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});
