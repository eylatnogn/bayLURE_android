import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LurePick, PlaybookSection, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { colors, radius, scoreColor, spacing } from '@/theme';

const categoryLabel: Record<LurePick['category'], string> = {
  lure: 'LURE',
  rig: 'RIG',
  bait: 'BAIT',
};

/** Renders a list of categorized playbook sections (clarity / pressure). */
function Playbook({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: PlaybookSection[];
}) {
  if (sections.length === 0) return null;
  return (
    <Section title={title}>
      <Text style={styles.playbookIntro}>{intro}</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.playbookSection}>
          <Text style={styles.playbookHeading}>{section.title}</Text>
          {section.tips.map((t, i) => (
            <View key={i} style={styles.factorRow}>
              <Text style={styles.bulletWater}>›</Text>
              <Text style={styles.factor}>{t}</Text>
            </View>
          ))}
        </View>
      ))}
    </Section>
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

function GearRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.gearRow}>
      <Text style={styles.gearLabel}>{label}</Text>
      <Text style={styles.gearValue}>{value}</Text>
    </View>
  );
}

type PickFilter = 'all' | 'lure' | 'rig' | 'bait';

const FILTERS: { id: PickFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lure', label: 'Lures' },
  { id: 'rig', label: 'Rigs' },
  { id: 'bait', label: 'Bait' },
];

/** Top picks for the selected filter; "all" keeps a varied 3-per-category mix. */
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

export function StrategyCard({ strategy }: { strategy: Strategy }) {
  const [filter, setFilter] = useState<PickFilter>('all');
  const available = new Set(strategy.picks.map((p) => p.category));
  const shown = displayPicks(strategy.picks, filter);

  return (
    <>
      <Section title="Throw This">
        <View style={styles.filterRow}>
          {FILTERS.filter((f) => f.id === 'all' || available.has(f.id)).map(
            (f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => setFilter(f.id)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            },
          )}
        </View>
        {shown.map((p, i) => (
          <PickRow key={`${p.name}-${i}`} pick={p} />
        ))}
      </Section>

      <Section
        title="Bite Forecast"
        right={
          <Text style={[styles.score, { color: scoreColor(strategy.biteScore) }]}>
            {strategy.biteScore}
            <Text style={styles.scoreMax}>/100</Text>
          </Text>
        }
      >
        <Text style={[styles.biteLabel, { color: scoreColor(strategy.biteScore) }]}>
          {strategy.biteLabel}
        </Text>
        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              {
                width: `${strategy.biteScore}%`,
                backgroundColor: scoreColor(strategy.biteScore),
              },
            ]}
          />
        </View>
        <Text style={styles.summary}>{strategy.summary}</Text>

        {strategy.aiNarrative ? (
          <View style={styles.ai}>
            <Text style={styles.aiLabel}>GUIDE'S TAKE (AI)</Text>
            <Text style={styles.aiText}>{strategy.aiNarrative}</Text>
          </View>
        ) : null}
      </Section>

      {strategy.behavior.length > 0 ? (
        <Section title="What the Fish Are Doing">
          {strategy.behavior.map((b, i) => (
            <View key={i} style={styles.factorRow}>
              <Text style={styles.bulletFish}>🐟</Text>
              <Text style={styles.factor}>{b}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Why">
        {strategy.factors.map((f, i) => (
          <View key={i} style={styles.factorRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.factor}>{f}</Text>
          </View>
        ))}
      </Section>

      <Playbook
        title="Water Clarity Playbook"
        intro="Tuned to the water clarity you reported:"
        sections={strategy.clarityPlaybook}
      />

      {strategy.pressurePlaybook ? (
        <Playbook
          title="Pressured-Water Playbook"
          intro="This water is heavily fished — outfinesse the crowd:"
          sections={strategy.pressurePlaybook}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  score: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreMax: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  biteLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  summary: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  ai: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  aiLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  aiText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  factorRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bullet: {
    color: colors.accent,
    marginRight: spacing.sm,
    fontSize: 14,
  },
  bulletWater: {
    color: colors.water,
    marginRight: spacing.sm,
    fontSize: 16,
    fontWeight: '800',
  },
  bulletFish: {
    marginRight: spacing.sm,
    fontSize: 13,
  },
  playbookIntro: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  playbookSection: {
    marginBottom: spacing.md,
  },
  playbookHeading: {
    color: colors.water,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  factor: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextActive: {
    color: colors.text,
  },
  pick: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pickHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  tag: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  tagText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pickDetails: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
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
  gearRow: {
    flexDirection: 'row',
  },
  gearLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    width: 38,
    textTransform: 'uppercase',
  },
  gearValue: {
    color: colors.text,
    fontSize: 12,
    flex: 1,
  },
});
