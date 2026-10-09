import type { HealthItemDefinition, ItemPreset } from './types.js';

/** Sample catalog: seeds the guest profile; registered users can add it on demand. */
export const PRESET_ITEMS: readonly ItemPreset[] = [
  { name: 'Vómito', emoji: '🤢', category: 'symptom', trackIntensity: true, trackDuration: false },
  { name: 'Heces blandas', emoji: '💩', category: 'symptom', trackIntensity: true, trackDuration: false },
  { name: 'Malestar / dolor', emoji: '😣', category: 'symptom', trackIntensity: true, trackDuration: true },
  { name: 'Pescado', emoji: '🐟', category: 'trigger', trackIntensity: false, trackDuration: false },
  { name: 'Lácteos', emoji: '🥛', category: 'trigger', trackIntensity: false, trackDuration: false },
  { name: 'Medicación', emoji: '💊', category: 'medication', trackIntensity: false, trackDuration: false },
];

/** Builds original (version 1) item definitions from the presets for one calendar. */
export function createPresetItems(
  calendarId: string,
  createId: () => string,
  now: Date = new Date(),
): HealthItemDefinition[] {
  return PRESET_ITEMS.map((preset) => {
    const id = createId();
    return {
      ...preset,
      id,
      calendarId,
      rootId: id,
      parentId: null,
      status: 'active',
      createdAt: now.toISOString(),
    };
  });
}
