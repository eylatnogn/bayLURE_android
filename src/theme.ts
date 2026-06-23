// Shared visual tokens. Warm, natural "morning on the water" palette — foliage
// greens, lake teal, sand and bark. Calm and understated rather than flashy.
import type { TextStyle, ViewStyle } from 'react-native';

// Warm, natural "morning on the water" palette — foliage greens, lake teal,
// sand and bark. Calm and understated rather than flashy.
export const colors = {
  bg: '#eef2ec', // soft morning-fog paper
  bgElevated: '#e4ebe1', // soft moss
  card: '#fbfdf8', // near-white leaf
  cardBorder: '#d4ddca', // sage border
  text: '#1f2b22', // deep forest
  textMuted: '#5b6a58', // moss gray-green
  accent: '#3a7d52', // foliage green (primary)
  accentDim: '#d7e6cf', // pale leaf (active backgrounds)
  water: '#2c7a74', // lake teal (secondary)
  warn: '#c08433', // warm ochre
  bad: '#b15240', // terracotta
  good: '#3f9050', // leaf green
  chip: '#e4ebe1',
  errorBg: '#f4e3da',
  errorBorder: '#cf9a86',
  errorText: '#7a3120',
  // Gradient header (deep pine -> forest) with light text.
  headerFrom: '#1e4a3c',
  headerTo: '#2f6e52',
  onDark: '#eaf3ea',
  onDarkMuted: '#bcd2c2',
  onAccent: '#f7faf3', // text on the accent green
};

export const gradients = {
  header: [colors.headerFrom, colors.headerTo] as const,
};

export const scoreColor = (score: number): string => {
  if (score >= 60) return colors.good;
  if (score >= 45) return colors.warn;
  return colors.bad;
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
};

// Soft, foliage-tinted elevation. Cards float just off the sage background
// instead of relying on a hard border — the single biggest "finished" cue.
export const shadow: { card: ViewStyle; bar: ViewStyle } = {
  card: {
    shadowColor: '#2e3b22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 3,
  },
  // Upward lift for the bottom tab bar so content tucks under it.
  bar: {
    shadowColor: '#2e3b22',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 12,
  },
};

// Shared pressed-state feedback for tappable surfaces — a subtle dim + shrink
// so every button and chip feels physical. Use as: pressed && pressedStyle.
export const pressedStyle: ViewStyle = {
  opacity: 0.82,
  transform: [{ scale: 0.98 }],
};

// Display (serif) for branding & key numbers; body stays the system sans.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
};

export const displayText = (size: number, color = colors.text): TextStyle => ({
  fontFamily: fonts.display,
  fontSize: size,
  color,
});
