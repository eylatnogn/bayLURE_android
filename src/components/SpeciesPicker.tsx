import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Species, WaterType } from '@/types';
import { speciesForWaterType } from '@/engine/species';
import { makeStyles, pressedStyle, radius, spacing } from '@/theme';

interface Props {
  waterType: WaterType;
  /** Selected species (empty = Any). */
  value: Species[];
  onToggle: (value: Species) => void;
  /** Clear all selections (Any species). */
  onClear: () => void;
}

/** Multi-select: "Any species" plus the species for the chosen water type. */
export function SpeciesPicker({ waterType, value, onToggle, onClear }: Props) {
  const styles = useStyles();
  const options = speciesForWaterType(waterType);
  const anyActive = value.length === 0;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onClear}
        style={[styles.chip, anyActive && styles.chipActive]}
      >
        <Text style={[styles.label, anyActive && styles.labelActive]}>
          Any species
        </Text>
      </Pressable>
      {options.map((opt) => {
        const active = value.includes(opt.id);
        return (
          <Pressable
            key={opt.id}
            onPress={() => onToggle(opt.id)}
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

const useStyles = makeStyles((colors) => ({
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
}));
