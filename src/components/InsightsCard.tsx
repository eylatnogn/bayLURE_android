import { StyleSheet, Text, View } from 'react-native';
import type { PlaybookSection, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { makeStyles, spacing } from '@/theme';

/** A categorized, always-open playbook: intro, then tactic sections. */
function Playbook({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: PlaybookSection[];
}) {
  const styles = useStyles();
  if (sections.length === 0) return null;

  return (
    <Section title={title}>
      <Text style={styles.intro}>{intro}</Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.heading}>{section.title}</Text>
          {section.tips.map((t, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.bulletWater}>›</Text>
              <Text style={styles.text}>{t}</Text>
            </View>
          ))}
        </View>
      ))}
    </Section>
  );
}

/** Which slice of the insights to render. Split so the Plan tab can show the
 * behavior/why in one detail tile and the playbooks in their own tile. */
type InsightsPart = 'behavior' | 'playbooks' | 'all';

export function InsightsCard({
  strategy,
  part = 'all',
}: {
  strategy: Strategy;
  part?: InsightsPart;
}) {
  const styles = useStyles();
  const showBehavior = part === 'behavior' || part === 'all';
  const showPlaybooks = part === 'playbooks' || part === 'all';
  return (
    <>
      {showBehavior && strategy.behavior.length > 0 ? (
        <Section title="What the Fish Are Doing">
          {strategy.behavior.map((b, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.bulletFish}>›</Text>
              <Text style={styles.text}>{b}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {showBehavior ? (
        <Section title="Why">
          {strategy.factors.map((f, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>{f}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      {showPlaybooks ? (
        <Playbook
          title="Water Clarity Playbook"
          intro="Tuned to the water clarity you reported."
          sections={strategy.clarityPlaybook}
        />
      ) : null}

      {showPlaybooks && strategy.pressurePlaybook ? (
        <Playbook
          title="Pressured-Water Playbook"
          intro="This water is heavily fished — outfinesse the crowd."
          sections={strategy.pressurePlaybook}
        />
      ) : null}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  intro: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  section: { marginBottom: spacing.md },
  heading: {
    color: colors.water,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', marginBottom: spacing.sm },
  bullet: { color: colors.accent, marginRight: spacing.sm, fontSize: 14 },
  bulletWater: { color: colors.water, marginRight: spacing.sm, fontSize: 16, fontWeight: '800' },
  bulletFish: { color: colors.water, marginRight: spacing.sm, fontSize: 16, fontWeight: '800' },
  text: { color: colors.text, fontSize: 13, lineHeight: 19, flex: 1 },
}));
