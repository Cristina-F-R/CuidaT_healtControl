// CuidaT color tokens (TECH_SPEC.md section 2). Single source for tailwind.config.js and for the PDF
// reports, which cannot use Tailwind classes.
export const PALETTE = {
  slate: {
    DEFAULT: '#496580',
    50: '#F3F6F9',
    100: '#E5EBF1',
    200: '#CBD6E0',
    300: '#A8B9C8',
    400: '#7E97AC',
    500: '#5F7C94',
    600: '#496580',
    700: '#3B5167',
    800: '#2F4153',
    900: '#243242',
    950: '#172029',
  },
  peach: '#FFDBBB',
  // "Vigilar posible patrón" only, never an item category.
  sun: '#FFF3BA',
  sky: '#BADDFF',
  mint: '#BAFFF5',
  tint: '#E6F4FE',
  canvas: '#FDFDFD',
  danger: {
    DEFAULT: '#DC2626',
    dark: '#B91C1C',
  },
} as const;
