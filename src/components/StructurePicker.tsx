import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StructureType, WaterType } from '@/types';
import { colors, radius, spacing } from '@/theme';

interface Option {
  value: StructureType;
  /** Water types this cover realistically occurs in. */
  waterTypes: WaterType[];
  /** Label tuned per water type (falls back to `label`). */
  freshLabel?: string;
  saltLabel?: string;
  label: string;
}

const OPTIONS: Option[] = [
  {
    value: 'vegetation',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'Weeds / grass',
    saltLabel: 'Grass flats',
    label: 'Vegetation',
  },
  { value: 'pads', waterTypes: ['freshwater'], label: 'Lily pads / mats' },
  {
    value: 'wood',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'Wood / laydowns',
    saltLabel: 'Docks / pilings',
    label: 'Wood',
  },
  {
    value: 'rock',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'Rock / rip-rap',
    saltLabel: 'Jetty / rocks',
    label: 'Rock',
  },
  { value: 'oyster', waterTypes: ['saltwater'], label: 'Oyster bars' },
  { value: 'mangrove', waterTypes: ['saltwater'], label: 'Mangroves' },
  {
    value: 'dropoff',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'Drop-off / ledge',
    saltLabel: 'Channel edge',
    label: 'Drop-off',
  },
  {
    value: 'current',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'River current',
    saltLabel: 'Inlet / pass',
    label: 'Current',
  },
  {
    value: 'open',
    waterTypes: ['freshwater', 'saltwater'],
    freshLabel: 'Open water',
    saltLabel: 'Flats / open',
    label: 'Open water',
  },
];

/** Cover types available for a given water type, in display order. */
export function structuresForWaterType(waterType: WaterType): StructureType[] {
  return OPTIONS.filter((o) => o.waterTypes.includes(waterType)).map(
    (o) => o.value,
  );
}

function labelFor(opt: Option, waterType: WaterType): string {
  if (waterType === 'freshwater' && opt.freshLabel) return opt.freshLabel;
  if (waterType === 'saltwater' && opt.saltLabel) return opt.saltLabel;
  return opt.label;
}

interface Props {
  waterType: WaterType;
  selected: StructureType[];
  onToggle: (value: StructureType) => void;
}

export function StructurePicker({ waterType, selected, onToggle }: Props) {
  const visible = OPTIONS.filter((o) => o.waterTypes.includes(waterType));
  return (
    <View style={styles.wrap}>
      {visible.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => onToggle(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {labelFor(opt, waterType)}
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
