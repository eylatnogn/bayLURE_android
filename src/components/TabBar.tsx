import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export type Tab = 'plan' | 'log' | 'guide';

const TABS: {
  id: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'plan', label: 'Plan', icon: 'fish-outline', iconActive: 'fish' },
  { id: 'log', label: 'Catch Log', icon: 'journal-outline', iconActive: 'journal' },
  { id: 'guide', label: 'Guide', icon: 'compass-outline', iconActive: 'compass' },
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
          <Pressable key={t.id} onPress={() => onChange(t.id)} style={styles.tab}>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <Ionicons
              name={active ? t.iconActive : t.icon}
              size={22}
              color={active ? colors.accent : colors.textMuted}
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
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  indicator: {
    height: 3,
    width: 26,
    borderRadius: 2,
    marginBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.accent,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  active: { color: colors.accent },
  inactive: { color: colors.textMuted, opacity: 0.7 },
});
