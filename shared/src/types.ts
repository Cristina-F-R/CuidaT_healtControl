// Domain types shared by client and server (TECH_SPEC.md sections 1, 5 and 6).
// Field names are camelCase; the server maps them to the snake_case columns.

export type ItemCategory = 'symptom' | 'trigger' | 'medication';

export type ItemStatus = 'active' | 'archived' | 'superseded';

export type Intensity = 1 | 2 | 3;

export type CorrelationWindowHours = 2 | 6 | 12 | 24 | 36 | 48;

export type ProfileColorTheme = 'slate' | 'peach' | 'sky' | 'mint';

export type PatternCategory = 'Vigilar posible patrón' | 'Patrón detectado';

/** Mark of a day in consultation mode and in reports (TECH_SPEC.md use case 12). */
export type DayMark = 'watch' | 'detected';

export type AuthMode = 'guest' | 'authenticated';

export interface CalendarProfile {
  id: string;
  name: string;
  /** Free text defined by the user (Mascota, Niño/a, Adulto, or any custom type). */
  profileType: string;
  avatarIcon: string;
  colorTheme: ProfileColorTheme;
  correlationWindowHours: CorrelationWindowHours;
  createdAt: string;
}

export interface HealthItemDefinition {
  id: string;
  calendarId: string;
  /** Lineage id: id of the first version (equals `id` for originals). */
  rootId: string;
  /** Previous version, `null` for originals. */
  parentId: string | null;
  name: string;
  emoji: string;
  category: ItemCategory;
  trackIntensity: boolean;
  trackDuration: boolean;
  status: ItemStatus;
  createdAt: string;
}

export interface HealthEventLog {
  id: string;
  calendarId: string;
  itemDefinitionId: string;
  /** ISO 8601 UTC instant. */
  loggedAt: string;
  intensity: Intensity | null;
  durationMinutes: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Input of the correlation engine (TECH_SPEC.md section 6). */
export interface HealthEvent {
  id: string;
  itemDefinitionId: string;
  rootItemId: string;
  category: ItemCategory;
  loggedAt: string;
  createdAt: string;
}

/** Output of the correlation engine (TECH_SPEC.md section 6). */
export interface PatternThreshold {
  triggerRootId: string;
  symptomRootId: string;
  /** Always `symptomEventIds.length`. */
  occurrences: number;
  category: PatternCategory;
  /** Symptom events counted as occurrences, in the stable event order. */
  symptomEventIds: string[];
  /**
   * Trigger/medication events that preceded a counted symptom within the window, in the stable event
   * order: the possible cause, marked on the calendar in consultation mode.
   */
  triggerEventIds: string[];
}

export type ItemPreset = Pick<HealthItemDefinition, 'name' | 'emoji' | 'category' | 'trackIntensity' | 'trackDuration'>;
