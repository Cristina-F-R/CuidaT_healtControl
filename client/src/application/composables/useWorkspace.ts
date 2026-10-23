import type { ProfileDraft } from '@cuidat/shared';
import { defineStore, storeToRefs } from 'pinia';
import { readonly, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { userMessageOf } from '../errors';
import { useAuthStore } from '../stores/useAuthStore';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';
import { useSyncStore } from '../stores/useSyncStore';
import { useCalendar } from './useCalendar';
import { useToast } from './useToast';

// The workspace needs an active profile to render, so App.vue waits for `ready` (also on reloads).
const useWorkspaceStore = defineStore('workspace', () => ({ ready: ref(false), loadError: ref<string | null>(null) }));

export function useWorkspaceReady(): Readonly<Ref<boolean>> {
  return readonly(storeToRefs(useWorkspaceStore()).ready);
}

/** Why the workspace could not load (for example, offline with no cached copy). */
export function useWorkspaceLoadError(): Readonly<Ref<string | null>> {
  return readonly(storeToRefs(useWorkspaceStore()).loadError);
}

/** Profile seeded on the first guest load (the demo calendar). */
const GUEST_PROFILE_DRAFT: ProfileDraft = {
  name: 'Moby',
  profileType: 'Mascota',
  avatarIcon: '🐶',
  colorTheme: 'slate',
  correlationWindowHours: 48,
};

/**
 * Account without any calendar (registered without guest data). Until the «Crea tu primer
 * calendario» onboarding of Phase 4, an empty calendar is created with default values.
 */
const FIRST_ACCOUNT_PROFILE_DRAFT: ProfileDraft = {
  name: 'Mi calendario',
  profileType: 'Adulto',
};

/**
 * Loads the calendars, the catalog and the logs of the active calendar. On the very first guest
 * load (no profile stored yet) it seeds the guest profile with the sample catalog.
 */
export async function loadWorkspace(): Promise<void> {
  const workspace = useWorkspaceStore();
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const itemStore = useItemDefinitionStore();
  const eventStore = useEventStore();

  workspace.loadError = null;
  try {
    await profileStore.loadProfiles();
    if (profileStore.profiles.length === 0) {
      const profile = await profileStore.createProfile(authStore.isGuest ? GUEST_PROFILE_DRAFT : FIRST_ACCOUNT_PROFILE_DRAFT);
      if (authStore.isGuest) {
        await itemStore.addPresetItems(profile.id);
      }
    }
    const calendarId = profileStore.activeProfileId;
    await Promise.all([itemStore.loadItems(calendarId), eventStore.loadLogs(calendarId)]);
  } catch (error) {
    workspace.loadError = userMessageOf(error);
    return;
  }
  await useSyncStore().refreshCounts();
  workspace.ready = true;
}

/** Empties every data store and loads the workspace again (sign-in, sign-out, account deletion). */
export async function reloadWorkspace(): Promise<void> {
  useWorkspaceStore().ready = false;
  useEventStore().resetState();
  useItemDefinitionStore().resetState();
  useProfileStore().resetState();
  // Guests only see the current month (ADR-018).
  if (useAuthStore().isGuest) {
    useCalendar().goToday();
  }
  await loadWorkspace();
}

/**
 * Registered users can go back in time: when the visible month is older than the loaded range,
 * its logs (and the correlation window before it) are fetched. Call once from App.vue.
 */
export function useMonthLoader(): void {
  const { activeMonthKey } = useCalendar();
  const profileStore = useProfileStore();
  const eventStore = useEventStore();
  const { showToast } = useToast();
  watch(activeMonthKey, async (monthKey) => {
    if (!profileStore.activeProfileId) {
      return;
    }
    try {
      await eventStore.ensureMonthLoaded(profileStore.activeProfileId, monthKey);
    } catch (error) {
      showToast(`No se pudieron cargar los registros de ese mes. ${userMessageOf(error)}`, { tone: 'warning' });
    }
  });
}
