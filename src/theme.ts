import { Platform, type TextStyle, type ViewStyle } from 'react-native';

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

// Display (serif) for branding & key numbers; body stays the system sans.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
};

// Soft, low shadow for gentle card depth (no harsh drop shadows).
export const shadow: ViewStyle =
  Platform.OS === 'web'
    ? ({ boxShadow: '0 4px 14px rgba(31,43,34,0.06)' } as unknown as ViewStyle)
    : {
        shadowColor: '#1f2b22',
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      };

export const displayText = (size: number, color = colors.text): TextStyle => ({
  fontFamily: fonts.display,
  fontSize: size,
  color,
});
