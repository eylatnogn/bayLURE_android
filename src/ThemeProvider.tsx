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

const PREF_KEY = 'baylure.themePref';

/**
 * Resolves the active theme from the user's preference (light / dark / follow
 * the OS) and exposes a toggle. The choice is persisted so it survives reloads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

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

  const mode: ThemeMode = pref === 'system' ? (systemScheme ?? 'light') : pref;

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
