import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';

export type Tab = 'plan' | 'log';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'plan', label: 'Plan', icon: '🎣' },
  { id: 'log', label: 'Catch Log', icon: '📓' },
];

interface Props {
  tab: Tab;
  onChange: (tab: Tab) => void;
}

export function TabBar({ tab, onChange }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = t.id === tab;
        return (
          <Pressable
            key={t.id}
            onPress={() => onChange(t.id)}
            style={styles.tab}
          >
            <Text style={[styles.icon, !active && styles.inactive]}>
              {t.icon}
            </Text>
            <Text style={[styles.label, active ? styles.active : styles.inactive]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  icon: {
    fontSize: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  active: {
    color: colors.accent,
  },
  inactive: {
    opacity: 0.55,
    color: colors.textMuted,
  },
});
