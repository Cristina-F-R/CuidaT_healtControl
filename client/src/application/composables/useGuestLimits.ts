import { DomainRuleError, GUEST_LOCKED_WARNING } from '@cuidat/shared';
import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useAuthStore } from '../stores/useAuthStore';
import { useOverlays } from './useOverlays';
import { useToast } from './useToast';

// Guest soft limits in the UI (TECH_SPEC.md use case 4, ADR-018). The rules themselves live in
// shared/src/guestLimits.ts; this composable only reacts to them.

export interface GuestLimits {
  isGuest: ComputedRef<boolean>;
  canNavigateMonths: ComputedRef<boolean>;
  /** Shows «Opción no disponible sin iniciar sesión.» with the «Crear cuenta» action. */
  showLockedNotice: () => void;
  /** Turns a guest-limit error from a store action into the notice; rethrows anything else. */
  handleStoreError: (error: unknown) => void;
}

export function useGuestLimits(): GuestLimits {
  const authStore = useAuthStore();
  const { openOverlay } = useOverlays();
  const { showToast } = useToast();

  const isGuest = computed(() => authStore.isGuest);

  function showLockedNotice(): void {
    showToast(GUEST_LOCKED_WARNING, {
      tone: 'warning',
      action: { label: 'Crear cuenta', run: () => openOverlay({ kind: 'auth', mode: 'register' }) },
    });
  }

  function handleStoreError(error: unknown): void {
    if (error instanceof DomainRuleError && error.code === 'GUEST_LIMIT') {
      showLockedNotice();
      return;
    }
    throw error;
  }

  return {
    isGuest,
    canNavigateMonths: computed(() => !isGuest.value),
    showLockedNotice,
    handleStoreError,
  };
}
