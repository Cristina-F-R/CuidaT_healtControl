import { createCalendarProfile, DEFAULT_CORRELATION_WINDOW_HOURS, DEFAULT_PROFILE_COLOR_THEME, DomainRuleError } from '@cuidat/shared';
import type { CalendarProfile, CorrelationWindowHours, ProfileColorTheme, ProfileDraft } from '@cuidat/shared';
import { ref } from 'vue';
import type { Ref } from 'vue';

export const PROFILE_TYPE_SUGGESTIONS: readonly string[] = ['Mascota', 'Niño/a', 'Adulto'];

export interface ProfileForm {
  name: Ref<string>;
  profileType: Ref<string>;
  avatarIcon: Ref<string>;
  colorTheme: Ref<ProfileColorTheme>;
  correlationWindowHours: Ref<CorrelationWindowHours>;
  error: Ref<string>;
  /** Validates with the domain rules; `null` (and `error` set) when something is wrong. */
  validate: () => ProfileDraft | null;
}

/** Suggestions for the type combobox: the three defaults plus the types the user already created. */
export function typeSuggestions(existingTypes: readonly string[]): string[] {
  return [...new Set([...PROFILE_TYPE_SUGGESTIONS, ...existingTypes])];
}

/** Form state of a calendar (ProfileEditModal.vue and the first-calendar onboarding). */
export function useProfileForm(initial?: CalendarProfile): ProfileForm {
  const name = ref(initial?.name ?? '');
  const profileType = ref(initial?.profileType ?? '');
  const avatarIcon = ref(initial?.avatarIcon ?? '👤');
  const colorTheme = ref<ProfileColorTheme>(initial?.colorTheme ?? DEFAULT_PROFILE_COLOR_THEME);
  const correlationWindowHours = ref<CorrelationWindowHours>(initial?.correlationWindowHours ?? DEFAULT_CORRELATION_WINDOW_HOURS);
  const error = ref('');

  function validate(): ProfileDraft | null {
    const draft: ProfileDraft = {
      name: name.value,
      profileType: profileType.value,
      avatarIcon: avatarIcon.value,
      colorTheme: colorTheme.value,
      correlationWindowHours: correlationWindowHours.value,
    };
    try {
      createCalendarProfile(draft, 'validation', '');
    } catch (failure) {
      if (failure instanceof DomainRuleError) {
        error.value = failure.message;
        return null;
      }
      throw failure;
    }
    error.value = '';
    return draft;
  }

  return { name, profileType, avatarIcon, colorTheme, correlationWindowHours, error, validate };
}
