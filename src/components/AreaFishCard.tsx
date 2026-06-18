import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Species } from '@/types';
import type { AreaFish } from '@/api/areaSpecies';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

interface Props {
  fish: AreaFish[];
  /** When provided, tapping a BALURE-supported fish sets it as the target. */
  onPickTarget?: (species: Species) => void;
  limit?: number;
}

export function AreaFishCard({ fish, onPickTarget, limit = 15 }: Props) {
  if (fish.length === 0) return null;
  const top = fish.slice(0, limit);
  const max = Math.max(...top.map((f) => f.count), 1);

  return (
    <Section title="Expected Fish Nearby">
      <Text style={styles.intro}>
        Most-reported fish around this spot (iNaturalist sightings). Tap a
        🎣 fish to set it as your target.
      </Text>
      {top.map((f) => {
        const tappable = !!(f.target && onPickTarget);
        const row = (
          <View style={styles.rowInner}>
            <View style={styles.nameCol}>
              <Text style={styles.common}>
                {f.commonName}
                {f.target ? <Text style={styles.targetMark}>  🎣</Text> : null}
              </Text>
              <Text style={styles.sci}>{f.scientificName}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${(f.count / max) * 100}%` }]}
                />
              </View>
            </View>
            <Text style={styles.count}>{f.count}</Text>
          </View>
        );
        return tappable ? (
          <Pressable
            key={f.taxonId}
            onPress={() => onPickTarget?.(f.target as Species)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            {row}
          </Pressable>
        ) : (
          <View key={f.taxonId} style={styles.row}>
            {row}
          </View>
        );
      })}
      <Text style={styles.footnote}>
        Observation data reflects what people have photographed nearby — a guide
        to what swims here, not a stocking survey.
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  row: {
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.accentDim,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameCol: {
    flex: 1,
    paddingRight: spacing.md,
  },
  common: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  targetMark: {
    fontSize: 13,
  },
  sci: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgElevated,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.water,
    borderRadius: 2,
  },
  count: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: spacing.md,
    opacity: 0.8,
  },
});
