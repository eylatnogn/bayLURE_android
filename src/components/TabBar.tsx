import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

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
  const { colors } = useTheme();
  const styles = useStyles();
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
            <View style={[styles.pill, active && styles.pillActive]}>
              <Feather
                name={t.icon}
                size={21}
                color={active ? colors.accent : colors.textMuted}
                style={!active && styles.inactive}
              />
              <Text style={[styles.label, active ? styles.active : styles.inactive]}>
                {t.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.card,
    borderTopWidth: 1,
    borderTopColor: c.cardBorder,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    ...t.shadow.bar,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: c.accentDim,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  active: { color: c.accent },
  inactive: { color: c.textMuted, opacity: 0.75 },
}));
