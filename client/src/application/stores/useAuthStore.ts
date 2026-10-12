import type { AuthMode } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// Phase 2: every session is a guest session. The login flow sets 'authenticated' in Phase 3.
export const useAuthStore = defineStore('auth', () => {
  const authMode = ref<AuthMode>('guest');
  const isGuest = computed(() => authMode.value === 'guest');

  function resetState(): void {
    authMode.value = 'guest';
  }

  return { authMode, isGuest, resetState };
});
