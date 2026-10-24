import { readonly, ref } from 'vue';
import type { Ref } from 'vue';
import { useInteraction } from './useInteraction';

// Consultation mode (TECH_SPEC.md use case 12, ADR-021): a read-only view for medical visits. It is a
// presentation state, not an access control: the API applies the same rules either way. It starts off
// on every load and is never persisted, so nobody finds the app locked without knowing why.
const consultationMode = ref(false);

function setConsultationMode(on: boolean): void {
  consultationMode.value = on;
  if (on) {
    // Nothing can be placed while it is on: drop a selected dock item or a drag in progress.
    const { clearSelection, endDrag } = useInteraction();
    clearSelection();
    endDrag();
  }
}

/** Back to normal mode (workspace reloads: sign-in, sign-out, account deletion). */
export function resetViewMode(): void {
  consultationMode.value = false;
}

export interface ViewModeState {
  consultationMode: Readonly<Ref<boolean>>;
  setConsultationMode: (on: boolean) => void;
}

export function useViewMode(): ViewModeState {
  return { consultationMode: readonly(consultationMode), setConsultationMode };
}
