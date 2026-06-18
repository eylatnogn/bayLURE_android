import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WaterType } from '@/types';
import { LURES } from '@/engine/lureDatabase';
import { colors, radius, spacing } from '@/theme';

interface Props {
  value: string | null;
  onChange: (name: string) => void;
  /** Optional filter so a saltwater catch only lists saltwater baits. */
  waterType?: WaterType;
}

const CATEGORY_LABEL: Record<string, string> = {
  lure: 'LURE',
  rig: 'RIG',
  bait: 'BAIT',
};

/** Single-select list of every lure/rig/bait in the BALURE knowledge base. */
export function LureSelect({ value, onChange, waterType }: Props) {
  const items = LURES.filter(
    (l) => !waterType || l.waterTypes.includes(waterType),
  );

  return (
    <View style={styles.list}>
      {items.map((l) => {
        const active = value === l.name;
        return (
          <Pressable
            key={l.name}
            onPress={() => onChange(l.name)}
            style={[styles.row, active && styles.rowActive]}
          >
            <View style={styles.radio}>
              {active ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={[styles.name, active && styles.nameActive]}>
              {l.name}
            </Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{CATEGORY_LABEL[l.category]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  rowActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  nameActive: {
    fontWeight: '700',
  },
  tag: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  tagText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
});
