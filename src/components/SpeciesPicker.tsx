import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Species, WaterType } from '@/types';
import { speciesForWaterType } from '@/engine/species';
import { colors, pressedStyle, radius, spacing } from '@/theme';

interface Props {
  waterType: WaterType;
  value: Species;
  onChange: (value: Species) => void;
}

/** Single-select: "Any species" plus the species for the chosen water type. */
export function SpeciesPicker({ waterType, value, onChange }: Props) {
  const options: { id: Species; label: string }[] = [
    { id: 'any', label: 'Any species' },
    ...speciesForWaterType(waterType).map((s) => ({ id: s.id, label: s.label })),
  ];

  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
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
