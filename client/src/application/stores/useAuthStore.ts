import type { AuthMode, AuthUser, LoginBody } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AuthGateway } from '../ports/auth';
import { ApiAuthGateway } from '../../infrastructure/auth/ApiAuthGateway';
import { ApiError, NetworkError } from '../../infrastructure/http/apiClient';
import { clearGuestStorage, readGuestDataForImport } from '../../infrastructure/repositories/guestStorage';
import { identifyUser } from '../../infrastructure/sentry';

export const useAuthStore = defineStore('auth', () => {
  const gateway: AuthGateway = new ApiAuthGateway();

  const user = ref<AuthUser | null>(null);
  /** Picks the repositories and the guest limits (TECH_SPEC.md section 3.1): local or API. */
  const authMode = computed<AuthMode>(() => (user.value ? 'authenticated' : 'guest'));
  const isGuest = computed(() => authMode.value === 'guest');
  const isSignedIn = computed(() => user.value !== null);

  function setUser(next: AuthUser | null): void {
    user.value = next;
    identifyUser(next?.id ?? null);
  }

  /** Restores the session from the cookie on load. Without a server the app keeps working locally. */
  async function restoreSession(): Promise<void> {
    try {
      setUser(await gateway.currentUser());
    } catch (error) {
      if (error instanceof NetworkError || error instanceof ApiError) {
        setUser(null);
        return;
      }
      throw error;
    }
  }

  async function login(credentials: LoginBody): Promise<void> {
    setUser(await gateway.login(credentials));
  }

  /**
   * Creates the account and imports the guest calendar in the same transaction. Once the server has
   * it, the browser copy is removed (ADR-020). The opt-out switch arrives in Phase 4.
   */
  async function register(credentials: LoginBody): Promise<void> {
    const created = await gateway.register({ ...credentials, guestData: readGuestDataForImport() });
    clearGuestStorage();
    setUser(created);
  }

  async function logout(): Promise<void> {
    await gateway.logout();
    setUser(null);
  }

  /** Deletes the account on the server. Wiping the local data is done by useAccount. */
  async function deleteAccount(): Promise<void> {
    await gateway.deleteAccount();
    setUser(null);
  }

  function resetState(): void {
    setUser(null);
  }

  return { authMode, user, isGuest, isSignedIn, restoreSession, login, register, logout, deleteAccount, resetState };
});
