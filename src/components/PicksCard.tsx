import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LurePick, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { colors, pressedStyle, radius, spacing } from '@/theme';

type PickFilter = 'all' | 'lure' | 'rig' | 'bait';

const CATEGORY_ORDER: LurePick['category'][] = ['lure', 'rig', 'bait'];

const FILTERS: { id: PickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lure', label: 'Lures' },
  { id: 'rig', label: 'Rigs' },
  { id: 'bait', label: 'Bait' },
];

// A short, plain-language explainer per type so it's clear at a glance what
// each group is and how it's meant to be used.
const groupMeta: Record<LurePick['category'], { title: string; blurb: string }> = {
  lure: { title: 'Lures', blurb: 'Artificial — cast and work them.' },
  rig: { title: 'Rigs', blurb: 'How to set up the hook + weight.' },
  bait: { title: 'Bait', blurb: 'Live or natural offerings.' },
};

function GearRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gearRow}>
      <Text style={styles.gearLabel}>{label}</Text>
      <Text style={styles.gearValue}>{value}</Text>
    </View>
  );
}

function PickRow({ pick }: { pick: LurePick }) {
  return (
    <View style={styles.pick}>
      <Text style={styles.pickName}>{pick.name}</Text>
      <Text style={styles.pickDetails}>{pick.details}</Text>
      <Text style={styles.pickReason}>{pick.reason}</Text>
      {pick.gear ? (
        <View style={styles.gear}>
          <GearRow label="Rod" value={pick.gear.rod} />
          <GearRow label="Line" value={pick.gear.line} />
          <GearRow label="Hook" value={pick.gear.hook} />
        </View>
      ) : null}
    </View>
  );
}

export function PicksCard({ strategy }: { strategy: Strategy }) {
  const [filter, setFilter] = useState<PickFilter>('all');
  const available = new Set(strategy.picks.map((p) => p.category));

  // Always render grouped under a labeled header so lures, rigs, and bait never
  // blur together. "All" shows the top few of each type; picking one type shows
  // more of just that one.
  const perGroup = filter === 'all' ? 3 : 6;
  const groups = CATEGORY_ORDER
    .filter((c) => filter === 'all' || c === filter)
    .map((category) => ({
      category,
      items: strategy.picks.filter((p) => p.category === category).slice(0, perGroup),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Section title="Throw This">
      <View style={styles.filterRow}>
        {FILTERS.filter((f) => f.id === 'all' || available.has(f.id)).map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipActive,
                pressed && pressedStyle,
              ]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {groups.map((g) => (
        <View key={g.category} style={styles.group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{groupMeta[g.category].title}</Text>
            <Text style={styles.groupBlurb}>{groupMeta[g.category].blurb}</Text>
          </View>
          {g.items.map((p, i) => (
            <PickRow key={`${p.name}-${i}`} pick={p} />
          ))}
        </View>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.text },
  group: { marginBottom: spacing.md },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupTitle: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupBlurb: { color: colors.textMuted, fontSize: 11, flexShrink: 1 },
  pick: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pickName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  pickDetails: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs, lineHeight: 18 },
  pickReason: {
    color: colors.accent,
    fontSize: 12,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  gear: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    gap: 2,
  },
  gearRow: { flexDirection: 'row' },
  gearLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    width: 38,
    textTransform: 'uppercase',
  },
  gearValue: { color: colors.text, fontSize: 12, flex: 1 },
});
