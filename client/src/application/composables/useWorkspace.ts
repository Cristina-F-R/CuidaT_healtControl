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
import { useInteraction } from './useInteraction';
import { resetMonthDensity, useMultiMonth } from './useMultiMonth';
import { useToast } from './useToast';

// The workspace needs an active profile to render, so App.vue waits for `ready` (also on reloads).
const useWorkspaceStore = defineStore('workspace', () => ({
  ready: ref(false),
  loadError: ref<string | null>(null),
  needsOnboarding: ref(false),
}));

export function useWorkspaceReady(): Readonly<Ref<boolean>> {
  return readonly(storeToRefs(useWorkspaceStore()).ready);
}

/** Why the workspace could not load (for example, offline with no cached copy). */
export function useWorkspaceLoadError(): Readonly<Ref<string | null>> {
  return readonly(storeToRefs(useWorkspaceStore()).loadError);
}

/** A signed-in account without any calendar: App.vue shows «Crea tu primer calendario». */
export function useNeedsOnboarding(): Readonly<Ref<boolean>> {
  return readonly(storeToRefs(useWorkspaceStore()).needsOnboarding);
}

/** Profile seeded on the first guest load (the demo calendar). */
const GUEST_PROFILE_DRAFT: ProfileDraft = {
  name: 'Moby',
  profileType: 'Mascota',
  avatarIcon: '🐶',
  colorTheme: 'slate',
  correlationWindowHours: 48,
};

/** Catalog and logs of one calendar (the initial range, ADR-007). Drops any selected dock item. */
async function loadCalendarData(calendarId: string): Promise<void> {
  useInteraction().clearSelection();
  await Promise.all([useItemDefinitionStore().loadItems(calendarId), useEventStore().loadLogs(calendarId)]);
}

/**
 * Loads the calendars, the catalog and the logs of the active calendar. On the very first guest
 * load (no profile stored yet) it seeds the guest profile with the sample catalog. An account
 * without calendars gets the onboarding instead (TECH_SPEC.md use case 6).
 */
export async function loadWorkspace(): Promise<void> {
  const workspace = useWorkspaceStore();
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const itemStore = useItemDefinitionStore();

  workspace.loadError = null;
  try {
    await profileStore.loadProfiles();
    if (profileStore.profiles.length === 0 && authStore.isGuest) {
      const profile = await profileStore.createProfile(GUEST_PROFILE_DRAFT);
      await itemStore.addPresetItems(profile.id);
    }
    workspace.needsOnboarding = profileStore.profiles.length === 0;
    if (!workspace.needsOnboarding) {
      await loadCalendarData(profileStore.activeProfileId);
    }
  } catch (error) {
    workspace.loadError = userMessageOf(error);
    return;
  }
  await useSyncStore().refreshCounts();
  workspace.ready = true;
}

/** «Crea tu primer calendario»: creates it with default values for the rest and opens the workspace. */
export async function completeOnboarding(draft: ProfileDraft): Promise<void> {
  const profile = await useProfileStore().createProfile(draft);
  await loadCalendarData(profile.id);
  useWorkspaceStore().needsOnboarding = false;
  await useSyncStore().refreshCounts();
}

/** Makes another calendar the active one and loads its catalog and logs. */
export async function switchCalendar(calendarId: string): Promise<void> {
  const profileStore = useProfileStore();
  if (calendarId === profileStore.activeProfileId) {
    return;
  }
  await loadCalendarData(calendarId);
  profileStore.activeProfileId = calendarId;
}

/** Creates a calendar and makes it the active one (registered users only; the guest limit is checked by the store). */
export async function createCalendar(draft: ProfileDraft): Promise<void> {
  const profile = await useProfileStore().createProfile(draft);
  await switchCalendar(profile.id);
}

/**
 * Deletes a calendar (ADR-003) and shows the one that takes its place when it was the active one. Its
 * logs still waiting in the sync queue are dropped: the server erased the calendar with them.
 */
export async function deleteCalendar(calendarId: string): Promise<void> {
  const profileStore = useProfileStore();
  const wasActive = calendarId === profileStore.activeProfileId;
  await profileStore.deleteProfile(calendarId);
  await useSyncStore().discardCalendar(calendarId);
  if (wasActive) {
    await loadCalendarData(profileStore.activeProfileId);
  }
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
  resetMonthDensity();
  await loadWorkspace();
}

/**
 * Registered users can go back in time: when the oldest visible month is older than the loaded range,
 * its logs (and the correlation window before it) are fetched. Call once from App.vue.
 */
export function useMonthLoader(): void {
  const { oldestMonthKey } = useMultiMonth();
  const profileStore = useProfileStore();
  const eventStore = useEventStore();
  const { showToast } = useToast();
  watch(oldestMonthKey, async (monthKey) => {
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
