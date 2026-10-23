import { computed } from 'vue';
import type { ComputedRef } from 'vue';
import { useAuthStore } from '../stores/useAuthStore';
import { useSyncStore } from '../stores/useSyncStore';

export interface SyncBadge {
  label: string;
  classes: string;
}

// STYLE_GUIDE.md, session UI: «Sin conexión» looks like «Modo Local».
const NEUTRAL = 'text-slate-600 bg-slate-100 border border-slate-200';
const SYNCED = 'text-slate-800 bg-mint/40 border border-mint';
const PENDING = 'text-slate-800 bg-peach/40 border border-peach';

/** The four header states of ADR-007: «Modo Local», «Sincronizado», «Pendiente (N)», «Sin conexión». */
export function syncBadge(local: boolean, online: boolean, pending: number): SyncBadge {
  if (local) {
    return { label: 'Modo Local', classes: NEUTRAL };
  }
  if (!online) {
    return { label: 'Sin conexión', classes: NEUTRAL };
  }
  if (pending > 0) {
    return { label: `Pendiente (${pending})`, classes: PENDING };
  }
  return { label: 'Sincronizado', classes: SYNCED };
}

export function useSyncStatus(): ComputedRef<SyncBadge> {
  const authStore = useAuthStore();
  const syncStore = useSyncStore();
  return computed(() => syncBadge(authStore.isGuest, syncStore.online, syncStore.pendingCount));
}
