import type { ItemCategory, ProfileColorTheme } from '@cuidat/shared';
import { Eye, TriangleAlert } from '@lucide/vue';
import type { Component } from 'vue';
import type { DayMark } from '../application/composables/usePatterns';

/** Category surfaces (TECH_SPEC.md section 2). Text on them is always `text-slate-800`. */
export const CATEGORY_SURFACE: Record<ItemCategory, string> = {
  symptom: 'bg-peach',
  trigger: 'bg-mint',
  medication: 'bg-sky',
};

/**
 * Pattern thresholds (TECH_SPEC.md section 2): insights cards and consultation day marks. Text on the
 * surface is `text-slate-800`; the color never goes alone (WCAG 1.4.1): the icon and label go with it.
 */
export const PATTERN_STYLE: Record<DayMark, { label: string; surface: string; border: string; icon: Component }> = {
  watch: { label: 'Vigilar posible patrón', surface: 'bg-sun', border: 'border-sun', icon: Eye },
  detected: { label: 'Patrón detectado', surface: 'bg-peach', border: 'border-peach', icon: TriangleAlert },
};

/**
 * Calendar color themes (`PROFILE_COLOR_THEMES`): the identity of a calendar (TECH_SPEC.md use case 6).
 * `surface` tints the avatar and the calendar menu, `band` the top edge of the calendar panel.
 */
export const PROFILE_THEME: Record<ProfileColorTheme, { surface: string; band: string; label: string }> = {
  slate: { surface: 'bg-slate-100', band: 'border-t-slate-300', label: 'Gris' },
  peach: { surface: 'bg-peach', band: 'border-t-peach', label: 'Melocotón' },
  sky: { surface: 'bg-sky', band: 'border-t-sky', label: 'Cielo' },
  mint: { surface: 'bg-mint', band: 'border-t-mint', label: 'Menta' },
};

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate focus-visible:ring-offset-2';
