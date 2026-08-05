/**
 * lore. design tokens — ported from the web app's CSS custom properties.
 *
 * These hex values are best-effort placeholders based on the named palette
 * (cream / raspberry / mustard) and the variable names actually seen in the
 * web codebase (--ink, --ink-soft, --paper, --teal). Swap these for the exact
 * values from the web app's globals.css if pixel-perfect match matters —
 * everything in the app reads from this one file, so it's a single edit.
 */

export const colors = {
  cream: '#F6F1E4', // app background
  paper: '#FFFCF5', // card / surface, lighter than cream
  ink: '#1F1B16', // primary text
  inkSoft: '#6B6255', // secondary / muted text
  raspberry: '#B23A52', // primary accent, CTAs
  raspberryDark: '#8E2C40', // pressed state
  mustard: '#E3A93B', // secondary accent
  teal: '#2F6F6B', // tertiary accent (avatar badges, etc.)
  border: '#E4DBC8', // hairline borders on cream/paper
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

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const fontFamily = {
  display: 'Fraunces_600SemiBold', // headings — the pixel-art serif voice
  displayItalic: 'Fraunces_500Medium_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_600SemiBold',
  mono: 'SpaceMono_400Regular', // stamps, timestamps, ticket codes
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

// Shared shadow for pixel-art "raised card" feel (used sparingly)
export const cardShadow = {
  shadowColor: colors.ink,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 0,
  elevation: 2,
} as const;
