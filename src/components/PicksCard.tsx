import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LurePick, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { LureArt } from '@/components/LureArt';
import { colors, pressedStyle, radius, scoreColor, spacing } from '@/theme';

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

const TOP_ALL = 3; // per category in the "All" overview
const TOP_FILTERED = 10; // per category when one type is selected

function GearRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gearRow}>
      <Text style={styles.gearLabel}>{label}</Text>
      <Text style={styles.gearValue}>{value}</Text>
    </View>
  );
}

/** Small label + body line used inside the full beginner guide. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

/** Compact row used in the "All" overview — thumbnail + name + color/size. */
function CompactRow({ pick }: { pick: LurePick }) {
  return (
    <View style={styles.compact}>
      <View style={styles.thumbSm}>
        <LureArt art={pick.art} size={50} />
      </View>
      <View style={styles.compactBody}>
        <Text style={styles.compactName}>{pick.name}</Text>
        <Text style={styles.compactDetails} numberOfLines={2}>
          {pick.details}
        </Text>
      </View>
    </View>
  );
}

/**
 * Full "beginner guide" card shown when a single type is selected: a big
 * illustration plus when/why, how to fish it, color & size, and tap-to-reveal
 * tackle. This is the learn-what-to-throw view.
 */
function GuideCard({ pick, rank }: { pick: LurePick; rank: number }) {
  const [showGear, setShowGear] = useState(false);
  return (
    <View style={styles.guide}>
      <View style={styles.guideHead}>
        <View style={styles.thumbLg}>
          <LureArt art={pick.art} size={76} />
        </View>
        <View style={styles.guideHeadText}>
          <View style={styles.guideTitleRow}>
            <Text style={styles.rank}>{rank}</Text>
            <Text style={styles.guideName}>{pick.name}</Text>
          </View>
          <View style={[styles.matchPill, { borderColor: scoreColor(pick.score) }]}>
            <View style={[styles.matchDot, { backgroundColor: scoreColor(pick.score) }]} />
            <Text style={styles.matchText}>{pick.score}% match today</Text>
          </View>
        </View>
      </View>

      <Field label="When & why" value={pick.reason} />
      <Field label="How to fish it" value={pick.howTo} />
      <Field label="Color & size" value={pick.details} />

      {pick.gear ? (
        <Pressable
          onPress={() => setShowGear((s) => !s)}
          style={({ pressed }) => [styles.gearToggle, pressed && pressedStyle]}
        >
          <Text style={styles.gearToggleText}>
            {showGear ? 'Hide tackle' : 'Tackle to use'}
          </Text>
          <Text style={styles.gearToggleChevron}>{showGear ? '−' : '+'}</Text>
        </Pressable>
      ) : null}
      {showGear && pick.gear ? (
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

  const countOf = (category: LurePick['category']) =>
    strategy.picks.filter((p) => p.category === category).length;

  const perGroup = filter === 'all' ? TOP_ALL : TOP_FILTERED;
  const groups = CATEGORY_ORDER
    .filter((c) => filter === 'all' || c === filter)
    .map((category) => ({
      category,
      total: countOf(category),
      items: strategy.picks.filter((p) => p.category === category).slice(0, perGroup),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Section title="Throw This">
      {filter === 'all' ? (
        <Text style={styles.intro}>
          Today's top picks, ranked for your conditions. Tap a type below for the
          top 10 with images and how to fish each.
        </Text>
      ) : null}

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

          {filter === 'all' ? (
            <>
              {g.items.map((p, i) => (
                <CompactRow key={`${p.name}-${i}`} pick={p} />
              ))}
              {g.total > g.items.length ? (
                <Pressable
                  onPress={() => setFilter(g.category)}
                  style={({ pressed }) => [styles.seeAll, pressed && pressedStyle]}
                >
                  <Text style={styles.seeAllText}>
                    See all {g.total} {groupMeta[g.category].title.toLowerCase()} & how to fish them →
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            g.items.map((p, i) => (
              <GuideCard key={`${p.name}-${i}`} pick={p} rank={i + 1} />
            ))
          )}
        </View>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.md,
  },
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

  // Compact "All" rows
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  thumbSm: {
    width: 58,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBody: { flex: 1 },
  compactName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  compactDetails: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  seeAll: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  seeAllText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  // Full beginner-guide cards
  guide: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  guideHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumbLg: {
    width: 88,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideHeadText: { flex: 1, gap: spacing.xs },
  guideTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rank: {
    color: colors.onAccent,
    backgroundColor: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 18,
    height: 18,
    lineHeight: 18,
    borderRadius: 9,
    textAlign: 'center',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  guideName: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  matchDot: { width: 6, height: 6, borderRadius: 3 },
  matchText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },

  field: { marginTop: spacing.md },
  fieldLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldValue: { color: colors.text, fontSize: 13, lineHeight: 18 },

  gearToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  gearToggleText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  gearToggleChevron: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  gear: { marginTop: spacing.sm, gap: 2 },
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
