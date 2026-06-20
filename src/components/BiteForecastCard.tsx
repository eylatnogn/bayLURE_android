import { StyleSheet, Text, View } from 'react-native';
import type { Strategy } from '@/types';
import { Section } from '@/components/Section';
import { colors, scoreColor, spacing } from '@/theme';

export function BiteForecastCard({ strategy }: { strategy: Strategy }) {
  return (
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
  );
}

const styles = StyleSheet.create({
  score: { fontSize: 28, fontWeight: '800' },
  scoreMax: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  biteLabel: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  barFill: { height: '100%', borderRadius: 4 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 20 },
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
  aiText: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
