import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Section } from '@/components/Section';
import { colors, radius, scoreColor, spacing } from '@/theme';

export interface ForecastDay {
  label: string;
  num: string;
  score: number;
}

interface Props {
  days: ForecastDay[];
  selected: number;
  onSelect: (index: number) => void;
}

/** A tappable 7-day bite-score outlook. Tap a day to see its full plan. */
export function ForecastStrip({ days, selected, onSelect }: Props) {
  return (
    <Section title="7-Day Outlook">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {days.map((d, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(i)}
              style={[styles.day, active && styles.dayActive]}
            >
              <Text style={[styles.label, active && styles.labelActive]}>
                {d.label}
              </Text>
              <Text style={[styles.num, active && styles.labelActive]}>
                {d.num}
              </Text>
              <View style={[styles.scorePill, { backgroundColor: scoreColor(d.score) }]}>
                <Text style={styles.scoreText}>{d.score}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>Tap a day to see its plan. Future days are midday estimates.</Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
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
  dayActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.text,
  },
  num: {
    color: colors.textMuted,
    fontSize: 11,
  },
  scorePill: {
    minWidth: 30,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
  },
  scoreText: {
    color: '#0e1f12',
    fontSize: 13,
    fontWeight: '900',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
});
