import type { ProfileDraft } from '@cuidat/shared';
import { useEventStore } from '../stores/useEventStore';
import { useItemDefinitionStore } from '../stores/useItemDefinitionStore';
import { useProfileStore } from '../stores/useProfileStore';

/** Profile seeded on the first guest load (the demo calendar). */
const GUEST_PROFILE_DRAFT: ProfileDraft = {
  name: 'Moby',
  profileType: 'Mascota',
  avatarIcon: '🐶',
  colorTheme: 'slate',
  correlationWindowHours: 48,
};

/**
 * Loads the calendars, the catalog and the logs of the active calendar. On the very first load
 * (no profile stored yet) it seeds the guest profile with the sample catalog.
 */
export async function loadWorkspace(): Promise<void> {
  const profileStore = useProfileStore();
  const itemStore = useItemDefinitionStore();
  const eventStore = useEventStore();

  await profileStore.loadProfiles();
  if (profileStore.profiles.length === 0) {
    const profile = await profileStore.createProfile(GUEST_PROFILE_DRAFT);
    await itemStore.addPresetItems(profile.id);
  }

  const calendarId = profileStore.activeProfileId;
  await Promise.all([itemStore.loadItems(calendarId), eventStore.loadLogs(calendarId)]);
}
