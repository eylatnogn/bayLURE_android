// Shared visual tokens + theming. The palette is a warm, natural "morning on
// the water" set for light mode, and a deep "night on the water" set for dark.
// Components build styles through `makeStyles`/`useTheme` so they react to the
// active theme at runtime; a static `colors` export (= light) is kept for
// back-compat so any not-yet-converted file still renders (in light).
import { createContext, useContext } from 'react';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  accent: string;
  /** Deeper accent used as the far stop of button gradients. */
  accentDeep: string;
  accentDim: string;
  water: string;
  warn: string;
  bad: string;
  good: string;
  chip: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  headerFrom: string;
  headerTo: string;
  onDark: string;
  onDarkMuted: string;
  onAccent: string;
}

// Warm, natural "morning on the water" palette — foliage greens, lake teal,
// sand and bark. Calm and understated.
export const lightColors: ThemeColors = {
  bg: '#eef2ec',
  bgElevated: '#e4ebe1',
  card: '#fbfdf8',
  cardBorder: '#d4ddca',
  text: '#1f2b22',
  textMuted: '#5b6a58',
  accent: '#3a7d52',
  accentDeep: '#2f6e52',
  accentDim: '#d7e6cf',
  water: '#2c7a74',
  warn: '#c08433',
  bad: '#b15240',
  good: '#3f9050',
  chip: '#e4ebe1',
  errorBg: '#f4e3da',
  errorBorder: '#cf9a86',
  errorText: '#7a3120',
  headerFrom: '#1e4a3c',
  headerTo: '#2f6e52',
  onDark: '#eaf3ea',
  onDarkMuted: '#bcd2c2',
  onAccent: '#f7faf3',
};

// "Night on the water" — deep forest and pine, with a brighter foliage accent
// that pops against the dark surfaces.
export const darkColors: ThemeColors = {
  bg: '#0f1713',
  bgElevated: '#18221c',
  card: '#1a241e',
  cardBorder: '#2c3a30',
  text: '#e8f0e7',
  textMuted: '#9aab9b',
  accent: '#5fbf83',
  accentDeep: '#2f8f5e',
  accentDim: '#1f3a2a',
  water: '#3fb0a6',
  warn: '#d9a043',
  bad: '#d0715c',
  good: '#5fbf83',
  chip: '#22302a',
  errorBg: '#36201a',
  errorBorder: '#6e3a2c',
  errorText: '#f0b9a6',
  headerFrom: '#102a20',
  headerTo: '#1c5440',
  onDark: '#eaf3ea',
  onDarkMuted: '#bcd2c2',
  onAccent: '#06140c',
};

export interface ThemeGradients {
  header: readonly [string, string];
  /** Primary button fill. */
  button: readonly [string, string];
  /** Full-screen page background. */
  bg: readonly [string, string];
}

export interface ThemeShadows {
  card: ViewStyle;
  bar: ViewStyle;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  gradients: ThemeGradients;
  shadow: ThemeShadows;
}

const lightShadow: ThemeShadows = {
  card: {
    shadowColor: '#2e3b22',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  bar: {
    shadowColor: '#2e3b22',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 12,
  },
};

// On dark surfaces a soft shadow barely shows; depth comes from the lifted card
// background and border. Keep a deeper, tighter shadow so elevation still reads.
const darkShadow: ThemeShadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
  bar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
};

function gradientsFor(c: ThemeColors): ThemeGradients {
  return {
    header: [c.headerFrom, c.headerTo],
    button: [c.accent, c.accentDeep],
    bg:
      c === darkColors
        ? ['#0f1713', '#0b120e']
        : ['#eef2ec', '#e7efe3'],
  };
}

export const lightTheme: Theme = {
  mode: 'light',
  colors: lightColors,
  gradients: gradientsFor(lightColors),
  shadow: lightShadow,
};

export const darkTheme: Theme = {
  mode: 'dark',
  colors: darkColors,
  gradients: gradientsFor(darkColors),
  shadow: darkShadow,
};

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

// What the user picked: an explicit mode, or follow the OS.
export type ThemePref = ThemeMode | 'system';

export interface ThemeContextValue extends Theme {
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
  /** Flip between light and dark, pinning an explicit preference. */
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  ...lightTheme,
  pref: 'system',
  setPref: () => {},
  toggle: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Build a memoized, theme-aware StyleSheet. Usage:
 *   const useStyles = makeStyles((c, t) => ({ card: { backgroundColor: c.card, ...t.shadow.card } }));
 *   ...
 *   const styles = useStyles();
 * There are only two theme objects (stable identities), so the cache is exact.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (c: ThemeColors, t: Theme) => T,
) {
  const cache = new Map<ThemeColors, T>();
  return function useStyles(): T {
    const theme = useTheme();
    let sheet = cache.get(theme.colors);
    if (!sheet) {
      sheet = StyleSheet.create(factory(theme.colors, theme));
      cache.set(theme.colors, sheet);
    }
    return sheet;
  };
}

// ---- Back-compat static exports (light). Any file not yet converted to the
// themed pattern keeps compiling and renders in light mode. ----
export const colors = lightColors;
export const gradients = lightTheme.gradients;
export const shadow = lightShadow;

// ---- Theme-independent tokens ----
export const scoreColor = (score: number, c: ThemeColors = lightColors): string => {
  if (score >= 60) return c.good;
  if (score >= 45) return c.warn;
  return c.bad;
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
  pill: 999,
};

// Shared pressed-state feedback for tappable surfaces — a subtle dim + shrink.
export const pressedStyle: ViewStyle = {
  opacity: 0.85,
  transform: [{ scale: 0.98 }],
};

// Display (serif) for branding & key numbers; body stays the system sans.
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
};

export const displayText = (size: number, color = lightColors.text): TextStyle => ({
  fontFamily: fonts.display,
  fontSize: size,
  color,
});
