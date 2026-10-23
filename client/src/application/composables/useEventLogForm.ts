import { DAY_PART_PRESETS } from '@cuidat/shared';
import type { HealthItemDefinition, Intensity } from '@cuidat/shared';
import dayjs from 'dayjs';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { userMessageOf } from '../errors';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { DAY_KEY_FORMAT } from './useCalendar';
import type { EventLogCreateOverlay, EventLogEditOverlay } from './useOverlays';

const TIME_FORMAT = 'HH:mm';
/** Default time for past days (ADR-016): the "Mediodía" preset. */
const MIDDAY = DAY_PART_PRESETS[1]!;

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface EventLogForm {
  isEdit: boolean;
  item: ComputedRef<HealthItemDefinition | undefined>;
  dayKey: string;
  /** `HH:mm` of the input; `max` of the input for today, so the time cannot pass the current instant. */
  time: Ref<string>;
  timeMax: string | undefined;
  intensity: Ref<Intensity | null>;
  durationText: Ref<string>;
  notes: Ref<string>;
  errorMessage: Ref<string>;
  save: () => Promise<boolean>;
  remove: () => Promise<void>;
}

/** State and rules of EventLogModal: create a log on a day, or edit / delete an existing one. */
export function useEventLogForm(request: EventLogCreateOverlay | EventLogEditOverlay): EventLogForm {
  const eventStore = useEventStore();
  const itemStore = useItemDefinitionStore();
  const profileStore = useProfileStore();

  const existing = request.mode === 'edit' ? (eventStore.logs.find((log) => log.id === request.logId) ?? null) : null;
  const item = computed(() => itemStore.findById(existing?.itemDefinitionId ?? (request.mode === 'create' ? request.itemId : '')));

  const dayKey = request.mode === 'create' ? request.dayKey : dayjs(existing?.loggedAt).format(DAY_KEY_FORMAT);
  const isToday = dayjs(dayKey).isSame(dayjs(), 'day');
  const currentTime = dayjs().format(TIME_FORMAT);

  const time = ref(
    existing ? dayjs(existing.loggedAt).format(TIME_FORMAT) : isToday ? currentTime : formatTime(MIDDAY.hour, MIDDAY.minute),
  );
  const intensity = ref<Intensity | null>(existing?.intensity ?? null);
  const duration = existing?.durationMinutes;
  const durationText = ref(duration === null || duration === undefined ? '' : String(duration));
  const notes = ref(existing?.notes ?? '');
  const errorMessage = ref('');

  /** Local day and time to a UTC instant, never later than now (ADR-016). */
  function toInstant(): string {
    const now = dayjs();
    const instant = dayjs(`${dayKey}T${time.value}`);
    return (instant.isAfter(now) ? now : instant).toISOString();
  }

  function parseDuration(): number | null {
    const text = durationText.value.trim();
    return text === '' ? null : Number(text);
  }

  async function save(): Promise<boolean> {
    errorMessage.value = '';
    const target = item.value;
    if (!target || (request.mode === 'edit' && !existing)) {
      errorMessage.value = 'El ítem ya no existe.';
      return false;
    }
    try {
      await eventStore.saveLog({
        existing,
        calendarId: profileStore.activeProfileId,
        item: target,
        loggedAt: toInstant(),
        intensity: intensity.value,
        durationMinutes: parseDuration(),
        notes: notes.value,
      });
      return true;
    } catch (error) {
      errorMessage.value = userMessageOf(error);
      return false;
    }
  }

  async function remove(): Promise<void> {
    if (existing) {
      await eventStore.removeLog(existing.id);
    }
  }

  return {
    isEdit: request.mode === 'edit',
    item,
    dayKey,
    time,
    timeMax: isToday ? currentTime : undefined,
    intensity,
    durationText,
    notes,
    errorMessage,
    save,
    remove,
  };
}
