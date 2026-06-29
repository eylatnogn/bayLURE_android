import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WaterType } from '@/types';
import { makeStyles, pressedStyle, radius, spacing } from '@/theme';

interface Props {
  value: WaterType;
  onChange: (value: WaterType) => void;
}

const OPTIONS: { value: WaterType; label: string }[] = [
  { value: 'freshwater', label: 'Freshwater' },
  { value: 'saltwater', label: 'Saltwater' },
];

export function WaterTypeToggle({ value, onChange }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.pill,
              active && styles.pillActive,
              pressed && pressedStyle,
            ]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
  },
}));
