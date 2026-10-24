import { DomainRuleError, GUEST_LOCKED_WARNING, isGuestProfileLimitReached } from '@cuidat/shared';
import type { CalendarProfile, ProfileDraft } from '@cuidat/shared';
import type { ProfilePatch } from '../ports/repositories';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { sanitizeText } from '../sanitizeText';
import { currentRepositories } from './currentRepositories';
import { useAuthStore } from './useAuthStore';

export const useProfileStore = defineStore('profiles', () => {
  const authStore = useAuthStore();

  const profiles = ref<CalendarProfile[]>([]);
  const activeProfileId = ref<string>('');

  const activeProfile = computed<CalendarProfile>(() => {
    const profile = profiles.value.find((candidate) => candidate.id === activeProfileId.value);
    if (!profile) {
      throw new DomainRuleError('PROFILE_NOT_FOUND', 'No hay ningún calendario activo.');
    }
    return profile;
  });

  /** Types the user already uses, for the type combobox. */
  const profileTypes = computed(() => [...new Set(profiles.value.map((profile) => profile.profileType))]);

  /** Non-zero profile invariant (TECH_SPEC.md ADR-003). */
  const canDeleteProfile = computed(() => profiles.value.length > 1);

  async function loadProfiles(): Promise<void> {
    profiles.value = await currentRepositories().profiles.list();
    if (!profiles.value.some((profile) => profile.id === activeProfileId.value)) {
      activeProfileId.value = profiles.value[0]?.id ?? '';
    }
  }

  async function createProfile(draft: ProfileDraft): Promise<CalendarProfile> {
    if (authStore.isGuest && isGuestProfileLimitReached(profiles.value)) {
      throw new DomainRuleError('GUEST_LIMIT', GUEST_LOCKED_WARNING);
    }
    const profile = await currentRepositories().profiles.create({
      ...draft,
      name: sanitizeText(draft.name),
      profileType: sanitizeText(draft.profileType),
    });
    profiles.value = [...profiles.value, profile];
    activeProfileId.value = activeProfileId.value || profile.id;
    return profile;
  }

  async function updateProfile(profileId: string, patch: ProfilePatch): Promise<CalendarProfile> {
    const clean: ProfilePatch = {
      ...patch,
      name: patch.name === undefined ? undefined : sanitizeText(patch.name),
      profileType: patch.profileType === undefined ? undefined : sanitizeText(patch.profileType),
    };
    const updated = await currentRepositories().profiles.update(profileId, clean);
    profiles.value = profiles.value.map((profile) => (profile.id === profileId ? updated : profile));
    return updated;
  }

  async function deleteProfile(profileId: string): Promise<void> {
    if (!canDeleteProfile.value) {
      throw new DomainRuleError('PROFILE_LAST', 'No se puede eliminar el último calendario.');
    }
    await currentRepositories().profiles.remove(profileId);
    await loadProfiles();
  }

  function resetState(): void {
    profiles.value = [];
    activeProfileId.value = '';
  }

  return {
    profiles,
    activeProfileId,
    activeProfile,
    canDeleteProfile,
    profileTypes,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    resetState,
  };
});
