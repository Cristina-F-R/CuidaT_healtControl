import type { ItemCategory } from '@cuidat/shared';

/** Category surfaces (TECH_SPEC.md section 2). Text on them is always `text-slate-800`. */
export const CATEGORY_SURFACE: Record<ItemCategory, string> = {
  symptom: 'bg-peach',
  trigger: 'bg-mint',
  medication: 'bg-sky',
};

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate focus-visible:ring-offset-2';
