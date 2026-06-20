import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, pressedStyle, shadow, spacing } from '@/theme';

export type Tab = 'plan' | 'log' | 'guide';

const TABS: { id: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: 'plan', label: 'Plan', icon: 'target' },
  { id: 'log', label: 'Catch Log', icon: 'book-open' },
  { id: 'guide', label: 'Guide', icon: 'compass' },
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
            style={({ pressed }) => [styles.tab, pressed && pressedStyle]}
          >
            <Feather
              name={t.icon}
              size={22}
              color={active ? colors.accent : colors.textMuted}
              style={!active && styles.inactive}
            />
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
    ...shadow.bar,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
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
