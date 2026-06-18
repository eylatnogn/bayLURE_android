import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { HomeScreen } from '@/screens/HomeScreen';
import { CatchLogScreen } from '@/screens/CatchLogScreen';
import { TabBar, type Tab } from '@/components/TabBar';
import { colors } from '@/theme';

export default function App() {
  const [tab, setTab] = useState<Tab>('plan');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.body}>
        {tab === 'plan' ? <HomeScreen /> : <CatchLogScreen />}
      </View>
      <TabBar tab={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
});
