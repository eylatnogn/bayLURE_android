import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  useFonts,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import type { CatchConditions } from '@/types';
import { HomeScreen } from '@/screens/HomeScreen';
import { CatchLogScreen } from '@/screens/CatchLogScreen';
import { HelpScreen } from '@/screens/HelpScreen';
import { TabBar, type Tab } from '@/components/TabBar';
import { ThemeProvider } from '@/ThemeProvider';
import { useTheme } from '@/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  // On the web build, mobile Safari flashes a tap highlight and selects text on
  // every tap, which makes the UI feel stuck. Suppress it app-wide while still
  // allowing selection inside text fields. No-op on native.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.textContent =
      '* { -webkit-tap-highlight-color: transparent; }' +
      'body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }' +
      'input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; }';
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell fontsLoaded={fontsLoaded} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { colors, gradients, mode } = useTheme();
  const [tab, setTab] = useState<Tab>('plan');
  // The most recent analyzed conditions, offered to the catch log to attach.
  const [snapshot, setSnapshot] = useState<CatchConditions | null>(null);

  if (!fontsLoaded) {
    return <View style={[styles.root, { backgroundColor: colors.bg }]} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <LinearGradient
        colors={gradients.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.root}>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <View style={styles.body}>
          {/* Keep both mounted so the planner's snapshot and form state persist
              across tab switches. */}
          <View style={[styles.screen, tab !== 'plan' && styles.hidden]}>
            <HomeScreen onSnapshot={setSnapshot} />
          </View>
          <View style={[styles.screen, tab !== 'log' && styles.hidden]}>
            <CatchLogScreen snapshot={snapshot} />
          </View>
          <View style={[styles.screen, tab !== 'guide' && styles.hidden]}>
            <HelpScreen />
          </View>
        </View>
        <TabBar tab={tab} onChange={setTab} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  screen: {
    ...StyleSheet.absoluteFillObject,
  },
  hidden: {
    display: 'none',
  },
});
