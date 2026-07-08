import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ThemeContext,
  themes,
  type ThemeContextValue,
  type ThemeMode,
  type ThemePref,
} from '@/theme';

// Bumped to .v2 when dark became the default, so any preference saved during
// earlier testing is ignored and the new default takes effect.
const PREF_KEY = 'baylure.themePref.v2';

/**
 * Resolves the active theme. Dark is the app's main theme and the default; the
 * user can switch to light (or follow the OS) via the toggle, and that choice
 * is persisted so it survives reloads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('dark');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(PREF_KEY)
      .then((saved) => {
        if (active && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setPrefState(saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setPref = (p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(PREF_KEY, p).catch(() => {});
  };

  // RN can also report 'unspecified'; treat anything but 'light' as dark
  // (the app defaults to dark).
  const mode: ThemeMode =
    pref === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : pref;

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...themes[mode],
      pref,
      setPref,
      toggle: () => setPref(mode === 'dark' ? 'light' : 'dark'),
    }),
    [mode, pref],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
