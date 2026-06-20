import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PlaybookSection, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { colors, pressedStyle, spacing } from '@/theme';

/** A collapsible, categorized playbook (collapsed by default to cut clutter). */
function Playbook({
  title,
  intro,
  sections,
  defaultOpen = false,
}: {
  title: string;
  intro: string;
  sections: PlaybookSection[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (sections.length === 0) return null;
  const tipCount = sections.reduce((n, s) => n + s.tips.length, 0);

  return (
    <Section
      title={title}
      right={
        <Pressable
          onPress={() => setOpen((v) => !v)}
          hitSlop={8}
          style={({ pressed }) => pressed && pressedStyle}
        >
          <Text style={styles.toggle}>{open ? 'Hide  ▴' : `Show ${tipCount}  ▾`}</Text>
        </Pressable>
      }
    >
      {open ? (
        <>
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
        </>
      ) : (
        <Text style={styles.collapsed}>{intro} Tap “Show” to read the playbook.</Text>
      )}
    </Section>
  );
}

export function InsightsCard({ strategy }: { strategy: Strategy }) {
  return (
    <>
      {strategy.behavior.length > 0 ? (
        <Section title="What the Fish Are Doing">
          {strategy.behavior.map((b, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.bulletFish}>›</Text>
              <Text style={styles.text}>{b}</Text>
            </View>
          ))}
        </Section>
      ) : null}

      <Section title="Why">
        {strategy.factors.map((f, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.text}>{f}</Text>
          </View>
        ))}
      </Section>

      <Playbook
        title="Water Clarity Playbook"
        intro="Tuned to the water clarity you reported."
        sections={strategy.clarityPlaybook}
      />

      {strategy.pressurePlaybook ? (
        <Playbook
          title="Pressured-Water Playbook"
          intro="This water is heavily fished — outfinesse the crowd."
          sections={strategy.pressurePlaybook}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  toggle: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  intro: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  collapsed: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
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
});
