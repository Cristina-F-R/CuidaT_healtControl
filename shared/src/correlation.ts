import { PATTERN_DETECTED_MIN_OCCURRENCES, PATTERN_WATCH_MIN_OCCURRENCES } from './constants.js';
import type { CorrelationWindowHours, DayMark, HealthEvent, PatternCategory, PatternThreshold } from './types.js';

const MS_PER_HOUR = 3_600_000;

interface PairAccumulator {
  triggerRootId: string;
  symptomRootId: string;
  /** Distinct symptom events that matched at least one trigger of the lineage. */
  symptomEventIds: Set<string>;
  /** Distinct trigger events of the lineage that matched at least one of those symptoms. */
  triggerEventIds: Set<string>;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Stable order (TECH_SPEC.md section 6): loggedAt, then createdAt, then id. */
function compareEvents(a: HealthEvent, b: HealthEvent): number {
  return (
    Date.parse(a.loggedAt) - Date.parse(b.loggedAt) ||
    Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
    compareText(a.id, b.id)
  );
}

/** 3 to 6 occurrences are watched, 7 or more are a detected pattern, fewer are not reported. */
export function classifyOccurrences(occurrences: number): PatternCategory | null {
  if (occurrences >= PATTERN_DETECTED_MIN_OCCURRENCES) {
    return 'Patrón detectado';
  }
  if (occurrences >= PATTERN_WATCH_MIN_OCCURRENCES) {
    return 'Vigilar posible patrón';
  }
  return null;
}

/**
 * Matches every symptom with the triggers/medication logged before it within the window.
 * `0 <= deltaHours <= windowHours`: an identical instant counts (trigger -> symptom order).
 * Items are grouped by lineage (`rootItemId`), so edited versions count as the same item.
 */
export function detectCorrelations(
  events: readonly HealthEvent[],
  windowHours: CorrelationWindowHours,
): PatternThreshold[] {
  const sorted = [...events].sort(compareEvents);
  const triggers = sorted.filter((event) => event.category !== 'symptom');
  const symptoms = sorted.filter((event) => event.category === 'symptom');
  const windowMs = windowHours * MS_PER_HOUR;
  const pairs = new Map<string, PairAccumulator>();

  for (const symptom of symptoms) {
    for (const trigger of triggers) {
      const deltaMs = Date.parse(symptom.loggedAt) - Date.parse(trigger.loggedAt);
      if (deltaMs < 0 || deltaMs > windowMs) {
        continue;
      }
      const key = `${trigger.rootItemId}|${symptom.rootItemId}`;
      const pair = pairs.get(key) ?? {
        triggerRootId: trigger.rootItemId,
        symptomRootId: symptom.rootItemId,
        symptomEventIds: new Set<string>(),
        triggerEventIds: new Set<string>(),
      };
      pair.symptomEventIds.add(symptom.id);
      pair.triggerEventIds.add(trigger.id);
      pairs.set(key, pair);
    }
  }

  const result: PatternThreshold[] = [];
  for (const pair of pairs.values()) {
    const occurrences = pair.symptomEventIds.size;
    const category = classifyOccurrences(occurrences);
    if (category) {
      result.push({
        triggerRootId: pair.triggerRootId,
        symptomRootId: pair.symptomRootId,
        occurrences,
        category,
        // Both lists keep the stable event order: symptoms are visited in order, and a trigger first matched
        // by a later symptom is always later than those matched before (an earlier one would be in both windows).
        symptomEventIds: [...pair.symptomEventIds],
        triggerEventIds: [...pair.triggerEventIds],
      });
    }
  }
  return result;
}

/**
 * Days to mark (consultation mode and reports, TECH_SPEC.md use case 12): the days of the triggers/medication
 * behind a reported pattern, the possible cause. "Patrón detectado" wins over "Vigilar posible patrón" on the
 * same day. `dayOfEvent` gives the local day of an event, or `undefined` when it is not known.
 */
export function markPatternDays(
  patterns: readonly Pick<PatternThreshold, 'category' | 'triggerEventIds'>[],
  dayOfEvent: (eventId: string) => string | undefined,
): Map<string, DayMark> {
  const marks = new Map<string, DayMark>();
  for (const pattern of patterns) {
    const mark: DayMark = pattern.category === 'Patrón detectado' ? 'detected' : 'watch';
    for (const eventId of pattern.triggerEventIds) {
      const dayKey = dayOfEvent(eventId);
      if (dayKey && marks.get(dayKey) !== 'detected') {
        marks.set(dayKey, mark);
      }
    }
  }
  return marks;
}
