/**
 * lore. design tokens — ported from the web app's CSS custom properties.
 *
 * These are the exact values from the web app's `app/globals.css` `:root`
 * block, not approximations. If the web app's palette changes, re-read that
 * file and update here — everything in this app reads from this one module.
 */

export const colors = {
  cream: '#F6F1E2', // app background
  creamDeep: '#EEE6D2', // recessed surface (uncollected stamps, wells)
  paper: '#FFFCF5', // card / surface, lighter than cream
  ink: '#18140E', // primary text, and every border
  inkSoft: '#3A3327', // secondary / muted text
  raspberry: '#E43B5C', // primary accent, CTAs
  mustard: '#F0AE1E', // secondary accent, selected states
  teal: '#2E6659', // tertiary accent (confirmations, badges)
  // No web equivalent — used by StatusBadge/Chip hairlines where the
  // 3px ink border would be too heavy.
  border: '#E4DBC8',
  danger: '#B23A3A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/**
 * The web app's `--line: 3px` — every card, button and input is outlined in
 * a heavy ink stroke. This is the load-bearing detail of the pixel-art look.
 */
export const borderWidth = 3;

export const radii = {
  field: 9, // .field input
  button: 10, // .btn
  card: 14, // .card
  pill: 999, // .chip
} as const;

export const fontFamily = {
  display: 'Fraunces_600SemiBold', // headings — the pixel-art serif voice
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_600SemiBold',
  mono: 'SpaceMono_400Regular', // eyebrows, field labels, timestamps, stamps
} as const;

export const fontSize = {
  xs: 12,
  sm: 13.5,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
} as const;

/**
 * React Native equivalent of the web's `box-shadow: Npx Npx 0 var(--ink)` —
 * a hard, un-blurred offset block rather than a soft drop shadow. Opacity is
 * 1 and radius is 0 on purpose; anything softer reads as Material, not as
 * the neo-brutalist look the web app uses.
 */
export function hardShadow(offset: number) {
  return {
    shadowColor: colors.ink,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: offset, // Android fallback — no hard-shadow equivalent there
  } as const;
}
