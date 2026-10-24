import { PALETTE } from './src/theme/palette.ts';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    // Only the CuidaT tokens exist (TECH_SPEC.md section 2): no default palette, no arbitrary colors.
    // The values live in src/theme/palette.ts, shared with the PDF reports.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      ...PALETTE,
    },
    extend: {
      fontFamily: {
        sans: ['"Nunito Sans Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
