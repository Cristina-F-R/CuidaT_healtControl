import { computed, ref } from 'vue';
import type { ComputedRef } from 'vue';

export type AuthFormMode = 'login' | 'register';

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
  /** Consultation mode: a log without editing actions (TECH_SPEC.md use case 12). */
  | { kind: 'eventDetail'; logId: string }
  | { kind: 'daySummary'; dayKey: string }
  | { kind: 'itemManager' }
  /** `profileId: null` creates a calendar. */
  | { kind: 'profileEdit'; profileId: string | null }
  | { kind: 'correlationFilter' }
  | { kind: 'auth'; mode: AuthFormMode }
  | { kind: 'deleteAccount' };

// A stack, so a modal opened from another one (e.g. "Editar" in the day summary) returns to it on close.
const stack = ref<Overlay[]>([]);

function openOverlay(overlay: Overlay): void {
  stack.value = [...stack.value, overlay];
}

function closeOverlay(): void {
  stack.value = stack.value.slice(0, -1);
}

function closeAllOverlays(): void {
  stack.value = [];
}

export interface OverlayState {
  topOverlay: ComputedRef<Overlay | null>;
  openOverlay: (overlay: Overlay) => void;
  closeOverlay: () => void;
  closeAllOverlays: () => void;
}

export function useOverlays(): OverlayState {
  const topOverlay = computed<Overlay | null>(() => stack.value[stack.value.length - 1] ?? null);
  return { topOverlay, openOverlay, closeOverlay, closeAllOverlays };
}
