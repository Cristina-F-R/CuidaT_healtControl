import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';

export interface EventLogCreateOverlay {
  kind: 'eventLog';
  mode: 'create';
  dayKey: string;
  itemId: string;
}

export interface EventLogEditOverlay {
  kind: 'eventLog';
  mode: 'edit';
  logId: string;
}

export type Overlay =
  | EventLogCreateOverlay
  | EventLogEditOverlay
  | { kind: 'daySummary'; dayKey: string }
  | { kind: 'itemManager' }
  | { kind: 'auth' };

// A stack, so a modal opened from another one (e.g. "Editar" in the day summary) returns to it on close.
const stack = ref<Overlay[]>([]);

function openOverlay(overlay: Overlay): void {
  stack.value = [...stack.value, overlay];
}

function closeOverlay(): void {
  stack.value = stack.value.slice(0, -1);
}

export interface OverlayState {
  topOverlay: ComputedRef<Overlay | null>;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
}

export function useOverlays(): OverlayState {
  const topOverlay = computed<Overlay | null>(() => stack.value[stack.value.length - 1] ?? null);
  return { topOverlay, openOverlay, closeOverlay };
}
