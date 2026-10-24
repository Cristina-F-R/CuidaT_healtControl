import { FUTURE_DATE_WARNING } from '@cuidat/shared';
import dayjs from 'dayjs';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useInteraction } from './useInteraction';
import { useOverlays } from './useOverlays';
import { useToast } from './useToast';
import { useViewMode } from './useViewMode';

/**
 * Places the selected dock item on a day (select-then-place or drag and drop).
 * Placement opens EventLogModal, where the time is chosen (ADR-016).
 */
export function usePlacement(): {
  placeItem: (itemId: string, dayKey: string) => void;
  activateDay: (dayKey: string) => void;
} {
  const itemStore = useItemDefinitionStore();
  const { selectedItemId } = useInteraction();
  const { showToast } = useToast();
  const { openOverlay } = useOverlays();
  const { consultationMode } = useViewMode();

  function placeItem(itemId: string, dayKey: string): void {
    const item = itemStore.findById(itemId);
    // Consultation mode is read-only (TECH_SPEC.md use case 12).
    if (!item || item.status !== 'active' || consultationMode.value) {
      return;
    }
    if (dayjs(dayKey).isAfter(dayjs(), 'day')) {
      showToast(FUTURE_DATE_WARNING, { tone: 'warning' });
      return;
    }
    openOverlay({ kind: 'eventLog', mode: 'create', dayKey, itemId });
  }

  /** Day button: places the selected item, or opens the day summary when nothing is selected. */
  function activateDay(dayKey: string): void {
    if (selectedItemId.value && !consultationMode.value) {
      placeItem(selectedItemId.value, dayKey);
      return;
    }
    openOverlay({ kind: 'daySummary', dayKey });
  }

  return { placeItem, activateDay };
}
