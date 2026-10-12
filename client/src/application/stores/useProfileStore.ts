import {
  createCalendarProfile,
  DomainRuleError,
  GUEST_LOCKED_WARNING,
  isGuestProfileLimitReached,
} from '@cuidat/shared';
import type { CalendarProfile, ProfileDraft } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createRepositories } from '../../infrastructure/repositories/createRepositories';
import { sanitizeText } from '../sanitizeText';
import { useAuthStore } from './useAuthStore';

export const useProfileStore = defineStore('profiles', () => {
  const authStore = useAuthStore();
  const repositories = createRepositories(authStore.authMode);

  const profiles = ref<CalendarProfile[]>([]);
  const activeProfileId = ref<string>('');

  const activeProfile = computed<CalendarProfile>(() => {
    const profile = profiles.value.find((candidate) => candidate.id === activeProfileId.value);
    if (!profile) {
      throw new DomainRuleError('PROFILE_NOT_FOUND', 'No hay ningún calendario activo.');
    }
    return profile;
  });

  /** Non-zero profile invariant (TECH_SPEC.md ADR-003). */
  const canDeleteProfile = computed(() => profiles.value.length > 1);

  async function loadProfiles(): Promise<void> {
    profiles.value = await repositories.profiles.list();
    if (!profiles.value.some((profile) => profile.id === activeProfileId.value)) {
      activeProfileId.value = profiles.value[0]?.id ?? '';
    }
  }

  async function createProfile(draft: ProfileDraft): Promise<CalendarProfile> {
    if (authStore.isGuest && isGuestProfileLimitReached(profiles.value)) {
      throw new DomainRuleError('GUEST_LIMIT', GUEST_LOCKED_WARNING);
    }
    const profile = createCalendarProfile(
      {
        ...draft,
        name: sanitizeText(draft.name),
        profileType: sanitizeText(draft.profileType),
      },
      crypto.randomUUID(),
      new Date().toISOString(),
    );
    await repositories.profiles.save(profile);
    profiles.value = [...profiles.value, profile];
    activeProfileId.value = activeProfileId.value || profile.id;
    return profile;
  }

  async function deleteProfile(profileId: string): Promise<void> {
    if (!canDeleteProfile.value) {
      throw new DomainRuleError('PROFILE_LAST', 'No se puede eliminar el último calendario.');
    }
    await repositories.profiles.remove(profileId);
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
    loadProfiles,
    createProfile,
    deleteProfile,
    resetState,
  };
});
