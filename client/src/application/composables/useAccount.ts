import type { CalendarProfile, HealthEventLog, HealthItemDefinition, LoginBody, SavedReport } from '@cuidat/shared';
import dayjs from 'dayjs';
import { downloadJson } from '../../infrastructure/download';
import { ApiError, NetworkError } from '../../infrastructure/http/apiClient';
import { clearAllRegisteredData, clearOfflineData } from '../../infrastructure/repositories/createRepositories';
import { clearGuestStorage } from '../../infrastructure/repositories/guestStorage';
import { PendingChangesError } from '../errors';
import { currentRepositories } from '../stores/currentRepositories';
import { useAuthStore } from '../stores/useAuthStore';
import { useSyncStore } from '../stores/useSyncStore';
import { useOverlays } from './useOverlays';
import { reloadWorkspace } from './useWorkspace';

export interface UserDataExport {
  format: 'cuidat-export';
  version: 1;
  exportedAt: string;
  account: { id: string; email: string } | null;
  calendars: (CalendarProfile & { items: HealthItemDefinition[]; logs: HealthEventLog[] })[];
  /** Saved reports with their snapshots (registered users; guests have none). */
  reports: SavedReport[];
}

/** The whole history: the export is not limited to the months loaded on screen. */
const ALL_TIME_FROM = '1970-01-01T00:00:00.000Z';

/** Every calendar with all its item versions and logs, and every saved report, read through the repositories. */
export async function buildUserDataExport(now: Date = new Date()): Promise<UserDataExport> {
  const authStore = useAuthStore();
  const repositories = currentRepositories();
  const range = { from: ALL_TIME_FROM, to: dayjs(now).add(1, 'day').toISOString() };
  const profiles = await repositories.profiles.list();
  const calendars = await Promise.all(profiles.map(async (profile) => {
    const [items, logs] = await Promise.all([repositories.items.list(profile.id), repositories.events.list(profile.id, range)]);
    return { ...profile, items, logs };
  }));
  const reportRepository = repositories.reports;
  const summaries = reportRepository ? await reportRepository.list() : [];
  const reports = reportRepository ? await Promise.all(summaries.map((summary) => reportRepository.get(summary.id))) : [];
  return {
    format: 'cuidat-export',
    version: 1,
    exportedAt: now.toISOString(),
    account: authStore.user ? { id: authStore.user.id, email: authStore.user.email } : null,
    calendars,
    reports,
  };
}

/** Message for a failed deletion; anything that is not an API or network failure is a bug and is rethrown. */
export function deletionFailureMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'No se pudo conectar con el servidor. Tu cuenta sigue activa.';
  }
  if (error instanceof ApiError) {
    return 'No se pudo eliminar la cuenta. Inténtalo de nuevo.';
  }
  throw error;
}

export interface AccountActions {
  /** Sign in and load the account's calendars from the API. */
  signIn: (credentials: LoginBody) => Promise<void>;
  /** Create the account with the guest calendar, then work against the API. */
  register: (credentials: LoginBody, migrateGuestData?: boolean) => Promise<void>;
  /** Refuses (PendingChangesError) while logs are waiting to be synced, so nothing is lost. */
  signOut: () => Promise<void>;
  /** «Descargar mis datos (JSON)» (GDPR Art. 20). */
  downloadMyData: () => Promise<void>;
  /** «Eliminar cuenta y datos» (GDPR Art. 17). Throws when the server refuses or cannot be reached. */
  deleteAccountAndData: () => Promise<void>;
}

export function useAccount(): AccountActions {
  const authStore = useAuthStore();
  const { closeAllOverlays } = useOverlays();

  async function signIn(credentials: LoginBody): Promise<void> {
    await authStore.login(credentials);
    await reloadWorkspace();
    void useSyncStore().flush();
  }

  async function register(credentials: LoginBody, migrateGuestData = true): Promise<void> {
    await authStore.register(credentials, migrateGuestData);
    await reloadWorkspace();
  }

  async function signOut(): Promise<void> {
    const sync = useSyncStore();
    await sync.flush();
    if (sync.pendingCount > 0) {
      throw new PendingChangesError(sync.pendingCount);
    }
    await authStore.logout();
    // The offline copy of the account must not stay in a shared browser.
    await clearOfflineData();
    sync.resetState();
    await reloadWorkspace();
  }

  async function downloadMyData(): Promise<void> {
    const data = await buildUserDataExport();
    downloadJson(`cuidat-mis-datos-${dayjs().format('YYYY-MM-DD')}.json`, data);
  }

  async function deleteAccountAndData(): Promise<void> {
    await authStore.deleteAccount();
    // The server data is gone; now nothing may stay in the browser either (ADR-020): the sync
    // queue and its failures, the offline copy and the guest document with its backup.
    await clearAllRegisteredData();
    clearGuestStorage();
    useSyncStore().resetState();
    authStore.resetState();
    closeAllOverlays();
    // Back to a fresh guest calendar: «Modo Local».
    await reloadWorkspace();
  }

  return { signIn, register, signOut, downloadMyData, deleteAccountAndData };
}
