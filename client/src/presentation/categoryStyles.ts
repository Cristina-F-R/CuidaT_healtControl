import type { ItemCategory, ProfileColorTheme } from '@cuidat/shared';

/** Category surfaces (TECH_SPEC.md section 2). Text on them is always `text-slate-800`. */
export const CATEGORY_SURFACE: Record<ItemCategory, string> = {
  symptom: 'bg-peach',
  trigger: 'bg-mint',
  medication: 'bg-sky',
};

/** Calendar color themes (`PROFILE_COLOR_THEMES`): the avatar surface and the pill label. */
export const PROFILE_THEME: Record<ProfileColorTheme, { surface: string; label: string }> = {
  slate: { surface: 'bg-slate-100', label: 'Gris' },
  peach: { surface: 'bg-peach', label: 'Melocotón' },
  sky: { surface: 'bg-sky', label: 'Cielo' },
  mint: { surface: 'bg-mint', label: 'Menta' },
};

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate focus-visible:ring-offset-2';
