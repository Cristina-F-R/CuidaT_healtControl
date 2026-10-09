import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

// Two placement modes (ADR-015):
// - Select-then-place, available on every device and with the keyboard: a dock item is a toggle
//   button; activating a valid day places the selected item.
// - Native HTML5 drag and drop, only as an enhancement when the primary input is a fine pointer.
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

const selectedItemId = ref<string | null>(null);
const draggingItemId = ref<string | null>(null);
const canDrag = ref(false);
let pointerQuery: MediaQueryList | null = null;

function watchPointerCapability(): void {
  if (pointerQuery || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  pointerQuery = window.matchMedia(FINE_POINTER_QUERY);
  canDrag.value = pointerQuery.matches;
  pointerQuery.addEventListener('change', (event) => {
    canDrag.value = event.matches;
    if (!event.matches) {
      draggingItemId.value = null;
    }
  });
}

function toggleSelection(itemId: string): void {
  selectedItemId.value = selectedItemId.value === itemId ? null : itemId;
}

function clearSelection(): void {
  selectedItemId.value = null;
}

function startDrag(itemId: string): void {
  if (canDrag.value) {
    draggingItemId.value = itemId;
  }
}

function endDrag(): void {
  draggingItemId.value = null;
}

export interface InteractionState {
  selectedItemId: Readonly<Ref<string | null>>;
  draggingItemId: Readonly<Ref<string | null>>;
  canDrag: Readonly<Ref<boolean>>;
  isDragging: ComputedRef<boolean>;
  toggleSelection: (itemId: string) => void;
  clearSelection: () => void;
  startDrag: (itemId: string) => void;
  endDrag: () => void;
}

export function useInteraction(): InteractionState {
  watchPointerCapability();
  return {
    selectedItemId,
    draggingItemId,
    canDrag,
    isDragging: computed(() => draggingItemId.value !== null),
    toggleSelection,
    clearSelection,
    startDrag,
    endDrag,
  };
}
