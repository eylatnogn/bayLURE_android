import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { Species, WaterType } from '@/types';
import { COLUMN_LABEL, speciesForWaterType, type WaterColumn } from '@/engine/species';
import { SearchPick } from '@/components/SearchPick';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

interface Props {
  waterType: WaterType;
  /** Selected species (empty = Any). */
  value: Species[];
  onToggle: (value: Species) => void;
  /** Clear all selections (Any species). */
  onClear: () => void;
}

/** How many popular species get an always-visible chip; the rest are searchable. */
const FEATURED = 6;

const COLUMN_ICON: Record<WaterColumn, 'chevrons-up' | 'minus' | 'chevrons-down'> = {
  top: 'chevrons-up',
  mid: 'minus',
  bottom: 'chevrons-down',
};

/**
 * Multi-select: "Any species" plus chips for the most popular species, with a
 * search box covering the full list (inshore + offshore). Selected species
 * show a "where they hold" water-column insight.
 */
export function SpeciesPicker({ waterType, value, onToggle, onClear }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const options = speciesForWaterType(waterType);
  const anyActive = value.length === 0;
  const featured = options.slice(0, FEATURED);
  const selected = options.filter((o) => value.includes(o.id));
  // Selected-but-not-featured fish (found via search) still get a chip.
  const extraSelected = selected.filter((o) => !featured.includes(o));
  const searchable = options
    .filter((o) => !value.includes(o.id))
    .map((o) => ({ name: o.label, tag: COLUMN_LABEL[o.column].toUpperCase() }));

  return (
    <View>
      <View style={styles.wrap}>
        <Pressable
          onPress={onClear}
          style={[styles.chip, anyActive && styles.chipActive]}
        >
          <Text style={[styles.label, anyActive && styles.labelActive]}>
            Any species
          </Text>
        </Pressable>
        {[...featured, ...extraSelected].map((opt) => {
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
      {options.length > FEATURED ? (
        <View style={styles.search}>
          <SearchPick
            placeholder="Search more fish — mahi, grouper, tuna…"
            options={searchable}
            allowCustom={false}
            onPick={(label) => {
              const opt = options.find((o) => o.label === label);
              if (opt) onToggle(opt.id);
            }}
          />
        </View>
      ) : null}
      {selected.length > 0 ? (
        <View style={styles.insight}>
          <Text style={styles.insightTitle}>Where they hold</Text>
          {selected.map((o) => (
            <View key={o.id} style={styles.insightRow}>
              <Feather name={COLUMN_ICON[o.column]} size={13} color={colors.accent} />
              <Text style={styles.insightText}>
                <Text style={styles.insightName}>{o.label}</Text>
                {'  ·  '}
                {COLUMN_LABEL[o.column]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
  search: {
    marginTop: spacing.sm,
  },
  insight: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  insightTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  insightText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  insightName: {
    color: colors.text,
    fontWeight: '700',
  },
}));
