import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StructureType } from '@/types';
import { colors, radius, spacing } from '@/theme';

interface Props {
  selected: StructureType[];
  onToggle: (value: StructureType) => void;
}

const OPTIONS: { value: StructureType; label: string }[] = [
  { value: 'vegetation', label: 'Weeds / grass' },
  { value: 'rock', label: 'Rock' },
  { value: 'wood', label: 'Wood / docks' },
  { value: 'dropoff', label: 'Drop-off / ledge' },
  { value: 'current', label: 'Current / inlet' },
  { value: 'open', label: 'Open water' },
];

export function StructurePicker({ selected, onToggle }: Props) {
  return (
    <View style={styles.wrap}>
      {OPTIONS.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => onToggle(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
  },
});
