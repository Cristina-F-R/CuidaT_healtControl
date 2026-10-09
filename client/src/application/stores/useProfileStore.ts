import { DEFAULT_CORRELATION_WINDOW_HOURS } from '@cuidat/shared';
import type { CalendarProfile } from '@cuidat/shared';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// Phase 1: a single in-memory guest profile. Phase 2 adds persistence through repositories.
function createGuestProfile(): CalendarProfile {
  return {
    id: crypto.randomUUID(),
    name: 'Moby',
    profileType: 'Mascota',
    avatarIcon: '🐶',
    colorTheme: 'slate',
    correlationWindowHours: DEFAULT_CORRELATION_WINDOW_HOURS,
    createdAt: new Date().toISOString(),
  };
}

export const useProfileStore = defineStore('profiles', () => {
  const profiles = ref<CalendarProfile[]>([createGuestProfile()]);
  const activeProfileId = ref<string>(profiles.value[0]!.id);

  const activeProfile = computed(
    () => profiles.value.find((profile) => profile.id === activeProfileId.value) ?? profiles.value[0]!,
  );
  const canDeleteProfile = computed(() => profiles.value.length > 1);

  function resetState(): void {
    profiles.value = [createGuestProfile()];
    activeProfileId.value = profiles.value[0]!.id;
  }

  return { profiles, activeProfileId, activeProfile, canDeleteProfile, resetState };
});
