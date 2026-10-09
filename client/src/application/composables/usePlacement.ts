import { DAY_PART_PRESETS, FUTURE_DATE_WARNING } from '@cuidat/shared';
import dayjs from 'dayjs';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useInteraction } from './useInteraction';
import { useToast } from './useToast';

const MIDDAY = DAY_PART_PRESETS[1]!;

/** Today: the current instant. Any past day: the "Mediodía" preset (ADR-016). */
function defaultLoggedAt(dayKey: string): string {
  const day = dayjs(dayKey);
  if (day.isSame(dayjs(), 'day')) {
    return dayjs().toISOString();
  }
  return day.hour(MIDDAY.hour).minute(MIDDAY.minute).second(0).millisecond(0).toISOString();
}

function formatDay(dayKey: string): string {
  return dayjs(dayKey).format('D [de] MMMM');
}

export function usePlacement(): {
  placeItem: (itemId: string, dayKey: string) => void;
  activateDay: (dayKey: string) => void;
} {
  const eventStore = useEventStore();
  const itemStore = useItemDefinitionStore();
  const profileStore = useProfileStore();
  const { selectedItemId } = useInteraction();
  const { showToast } = useToast();

  function placeItem(itemId: string, dayKey: string): void {
    const item = itemStore.findById(itemId);
    if (!item || item.status !== 'active') {
      return;
    }
    if (dayjs(dayKey).isAfter(dayjs(), 'day')) {
      showToast(FUTURE_DATE_WARNING, { tone: 'warning' });
      return;
    }
    // Phase 1 stores the event directly with a default time. Phase 2 opens EventLogModal.vue instead.
    const now = new Date().toISOString();
    eventStore.addLog({
      id: crypto.randomUUID(),
      calendarId: profileStore.activeProfileId,
      itemDefinitionId: item.id,
      loggedAt: defaultLoggedAt(dayKey),
      intensity: null,
      durationMinutes: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    });
    showToast(`${item.emoji} ${item.name} añadido el ${formatDay(dayKey)}.`);
  }

  /** Day button: places the selected item, or summarises the day when nothing is selected. */
  function activateDay(dayKey: string): void {
    if (selectedItemId.value) {
      placeItem(selectedItemId.value, dayKey);
      return;
    }
    // Phase 2 replaces this summary with DaySummaryModal.vue.
    const count = eventStore.logsByDay.get(dayKey)?.length ?? 0;
    showToast(
      count === 0
        ? `Sin registros el ${formatDay(dayKey)}. Selecciona un ítem del panel y pulsa el día para añadirlo.`
        : `${count} ${count === 1 ? 'registro' : 'registros'} el ${formatDay(dayKey)}.`,
    );
  }

  return { placeItem, activateDay };
}
