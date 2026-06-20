import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LurePick, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

const categoryLabel: Record<LurePick['category'], string> = {
  lure: 'LURE',
  rig: 'RIG',
  bait: 'BAIT',
};

type PickFilter = 'all' | 'lure' | 'rig' | 'bait';

const FILTERS: { id: PickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lure', label: 'Lures' },
  { id: 'rig', label: 'Rigs' },
  { id: 'bait', label: 'Bait' },
];

function displayPicks(picks: LurePick[], filter: PickFilter): LurePick[] {
  if (filter !== 'all') {
    return picks.filter((p) => p.category === filter).slice(0, 6);
  }
  const counts: Record<string, number> = {};
  const out: LurePick[] = [];
  for (const p of picks) {
    const n = counts[p.category] ?? 0;
    if (n >= 3) continue;
    counts[p.category] = n + 1;
    out.push(p);
    if (out.length >= 6) break;
  }
  return out;
}

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
      <View style={styles.pickHead}>
        <Text style={styles.pickName}>{pick.name}</Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{categoryLabel[pick.category]}</Text>
        </View>
      </View>
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
  const shown = displayPicks(strategy.picks, filter);

  return (
    <Section title="Throw This">
      <View style={styles.filterRow}>
        {FILTERS.filter((f) => f.id === 'all' || available.has(f.id)).map((f) => {
          const active = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {shown.map((p, i) => (
        <PickRow key={`${p.name}-${i}`} pick={p} />
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
  pick: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pickHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  tag: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  tagText: { color: colors.text, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
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
