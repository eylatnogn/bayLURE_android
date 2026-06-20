import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BestWindow, HourBite } from '@/types';
import { Section } from '@/components/Section';
import { colors, radius, scoreColor, spacing } from '@/theme';

const BAR_MAX = 64;

interface Props {
  hourly: HourBite[];
  bestWindows: BestWindow[];
}

export function HourlyBiteCard({ hourly, bestWindows }: Props) {
  if (hourly.length === 0) return null;

  return (
    <Section title="Hourly Bite & Best Times">
      {bestWindows.length > 0 ? (
        <View style={styles.windows}>
          {bestWindows.map((w, i) => (
            <View key={i} style={styles.window}>
              <Text style={styles.target}>🎯</Text>
              <Text style={styles.windowRange}>{w.range}</Text>
              <View style={[styles.windowPill, { backgroundColor: scoreColor(w.score) }]}>
                <Text style={styles.windowPillText}>{w.biteLabel}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.flat}>No standout window today — a steady, even bite.</Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chart}
      >
        {hourly.map((h, i) => (
          <View key={i} style={[styles.col, !h.isDay && styles.night]}>
            <Text style={styles.colScore}>{h.score}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, (h.score / 100) * BAR_MAX),
                    backgroundColor: scoreColor(h.score),
                  },
                ]}
              />
            </View>
            <Text style={styles.colLabel}>{h.label}</Text>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.hint}>
        Bite graded hour by hour. Night hours are dimmed; peaks usually fall
        around dawn and dusk.
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  windows: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  window: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  target: { fontSize: 14, marginRight: spacing.sm },
  windowRange: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  windowPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
  },
  windowPillText: {
    color: '#0e1f12',
    fontSize: 12,
    fontWeight: '900',
  },
  flat: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  chart: {
    gap: spacing.sm,
    alignItems: 'flex-end',
    paddingVertical: spacing.xs,
  },
  col: {
    width: 34,
    alignItems: 'center',
  },
  night: { opacity: 0.45 },
  colScore: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  barTrack: {
    height: BAR_MAX,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 16,
    borderRadius: 4,
  },
  colLabel: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: spacing.md,
  },
});
