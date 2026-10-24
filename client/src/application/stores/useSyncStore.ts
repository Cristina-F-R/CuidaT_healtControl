import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getSyncQueue } from '../../infrastructure/repositories/createRepositories';
import { flushQueue } from '../../infrastructure/sync/flushQueue';
import type { FlushStatus } from '../../infrastructure/sync/flushQueue';
import { useToast } from '../composables/useToast';
import { useAuthStore } from './useAuthStore';

export const RETRY_MIN_MS = 5_000;
export const RETRY_MAX_MS = 5 * 60_000;

/**
 * Offline sync of event logs (ADR-007). The queue is flushed on start, on the `online` event, when
 * the tab becomes visible, after each local change while online, and by an exponential-backoff
 * timer (5 s up to 5 min) after a network or server error.
 */
export const useSyncStore = defineStore('sync', () => {
  const authStore = useAuthStore();
  const { showToast } = useToast();

  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
  const pendingCount = ref(0);
  const failedCount = ref(0);
  const lastStatus = ref<FlushStatus>('done');

  let flushing: Promise<void> | null = null;
  let again = false;
  let retryDelay = RETRY_MIN_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let started = false;

  async function refreshCounts(): Promise<void> {
    const userId = authStore.user?.id;
    const queue = getSyncQueue();
    pendingCount.value = userId ? (await queue.all()).filter((operation) => operation.payload.userId === userId).length : 0;
    failedCount.value = userId ? (await queue.failed()).filter((entry) => entry.operation.payload.userId === userId).length : 0;
  }

  function clearRetry(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function scheduleRetry(): void {
    clearRetry();
    retryTimer = setTimeout(() => void flush(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  }

  async function runFlush(userId: string): Promise<void> {
    do {
      again = false;
      const result = await flushQueue(getSyncQueue(), userId);
      lastStatus.value = result.status;
      if (result.failed > 0) {
        showToast(`${result.failed === 1 ? 'Un registro no se pudo' : `${result.failed} registros no se pudieron`} sincronizar: el servidor los rechazó.`, { tone: 'warning' });
      }
      if (result.status === 'retry') {
        scheduleRetry();
        return;
      }
      if (result.status === 'unauthorized') {
        showToast('Tu sesión ha caducado. Inicia sesión de nuevo para sincronizar tus registros.', { tone: 'warning' });
        return;
      }
      clearRetry();
      retryDelay = RETRY_MIN_MS;
    } while (again);
  }

  /** Sends what is queued. Calls during a run are folded into one more pass. */
  async function flush(): Promise<void> {
    const userId = authStore.user?.id;
    if (!userId) {
      await refreshCounts();
      return;
    }
    if (flushing) {
      again = true;
      return flushing;
    }
    flushing = runFlush(userId).finally(async () => {
      flushing = null;
      await refreshCounts();
    });
    return flushing;
  }

  /** After each local change: count it and, with connection, send it right away. */
  async function notifyChange(): Promise<void> {
    await refreshCounts();
    if (online.value) {
      await flush();
    }
  }

  function onOnline(): void {
    online.value = true;
    retryDelay = RETRY_MIN_MS;
    void flush();
  }

  function onOffline(): void {
    online.value = false;
  }

  function onVisibility(): void {
    if (document.visibilityState === 'visible') {
      void flush();
    }
  }

  function start(): void {
    if (!started) {
      started = true;
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      document.addEventListener('visibilitychange', onVisibility);
    }
    void flush();
  }

  function stop(): void {
    started = false;
    clearRetry();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisibility);
  }

  /** Empties the queue and the failures (account deletion). */
  async function clearQueue(): Promise<void> {
    clearRetry();
    await getSyncQueue().clear();
    await refreshCounts();
  }

  /** Drops what is still queued for a calendar that no longer exists (calendar deletion). */
  async function discardCalendar(calendarId: string): Promise<void> {
    await getSyncQueue().discardCalendar(calendarId);
    await refreshCounts();
  }

  async function dismissFailures(): Promise<void> {
    await getSyncQueue().clearFailed();
    await refreshCounts();
  }

  function resetState(): void {
    clearRetry();
    retryDelay = RETRY_MIN_MS;
    pendingCount.value = 0;
    failedCount.value = 0;
    lastStatus.value = 'done';
  }

  return { online, pendingCount, failedCount, lastStatus, refreshCounts, flush, notifyChange, start, stop, clearQueue, discardCalendar, dismissFailures, resetState };
});
