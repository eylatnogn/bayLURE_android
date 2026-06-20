// Shared visual tokens. Warm, outdoors "on the bank at sunrise" palette —
// foliage greens, water teal, sand and bark rather than the old space-y navy.
import type { ViewStyle } from 'react-native';

export const colors = {
  bg: '#eef1e4', // pale sage paper
  bgElevated: '#e3e9d3', // soft moss
  card: '#f8faf1', // near-white leaf
  cardBorder: '#ccd6b6', // sage border
  text: '#222e1c', // deep forest
  textMuted: '#5d6a4d', // moss gray-green
  accent: '#3c7a4e', // forest green
  accentDim: '#cfe0c2', // light leaf (active backgrounds on light theme)
  water: '#2f7d72', // lake teal (secondary accent)
  warn: '#bf7f2b', // amber / clay
  bad: '#b04a34', // rust
  good: '#3f8f3a', // leaf green
  chip: '#e3e9d3',
  errorBg: '#f5e2da',
  errorBorder: '#c98a78',
  errorText: '#7a3120',
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
  lg: 16,
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
