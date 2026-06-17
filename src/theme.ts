// Shared visual tokens. Dark, "on the water at dawn" palette.

export const colors = {
  bg: '#0b1f33',
  bgElevated: '#12304d',
  card: '#16395a',
  cardBorder: '#1f4a73',
  text: '#eaf2fb',
  textMuted: '#9bb6d1',
  accent: '#36c6a8',
  accentDim: '#1d6b5c',
  warn: '#f2b14c',
  bad: '#e3674f',
  good: '#5fcf7d',
  chip: '#1d4a73',
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
