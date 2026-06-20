import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BestWindow, HourBite } from '@/types';
import { Section } from '@/components/Section';
import { colors, radius, scoreColor, spacing } from '@/theme';

const BAR_MAX = 60;

export interface OutlookDay {
  label: string;
  num: string;
  score: number;
}

interface Props {
  days: OutlookDay[];
  selected: number;
  onSelect: (index: number) => void;
  hourly: HourBite[];
  bestWindows: BestWindow[];
}

/** Combined 7-day outlook + hourly bite for the selected day, in one section. */
export function OutlookCard({ days, selected, onSelect, hourly, bestWindows }: Props) {
  return (
    <Section title="7-Day Outlook & Hourly Bite">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
      >
        {days.map((d, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(i)}
              style={[styles.day, active && styles.dayActive]}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                {d.label}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayLabelActive]}>
                {d.num}
              </Text>
              <View style={[styles.dayPill, { backgroundColor: scoreColor(d.score) }]}>
                <Text style={styles.dayPillText}>{d.score}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.divider} />

      {bestWindows.length > 0 ? (
        <View style={styles.windows}>
          <Text style={styles.subhead}>Best bite times</Text>
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
      ) : hourly.length > 0 ? (
        <Text style={styles.flat}>No standout window — a steady, even bite.</Text>
      ) : null}

      {hourly.length > 0 ? (
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
      ) : null}

      <Text style={styles.hint}>
        Tap a day for its plan. Bite graded hour by hour (night dimmed); peaks
        usually fall around dawn and dusk. Future days are forecasts.
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  dayRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  day: {
    width: 58,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4,
  },
  dayActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  dayLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  dayLabelActive: { color: colors.text },
  dayNum: { color: colors.textMuted, fontSize: 11 },
  dayPill: {
    minWidth: 30,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  dayPillText: { color: '#0e1f12', fontSize: 13, fontWeight: '900' },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: spacing.md,
  },
  subhead: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  windows: { gap: spacing.sm, marginBottom: spacing.md },
  window: { flexDirection: 'row', alignItems: 'center' },
  target: { fontSize: 14, marginRight: spacing.sm },
  windowRange: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  windowPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 10 },
  windowPillText: { color: '#0e1f12', fontSize: 12, fontWeight: '900' },
  flat: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  chart: { gap: spacing.sm, alignItems: 'flex-end', paddingVertical: spacing.xs },
  col: { width: 34, alignItems: 'center' },
  night: { opacity: 0.45 },
  colScore: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  barTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  bar: { width: 16, borderRadius: 4 },
  colLabel: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: spacing.md },
});
