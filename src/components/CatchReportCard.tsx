// The catch-log report: the angler's personal patterns mined from logged
// catches, plus upcoming forecast days that resemble the conditions they've
// caught fish in. Designed to reward attaching conditions to every catch.
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { CatchRecord, Conditions } from '@/types';
import {
  buildCatchReport,
  matchUpcomingDays,
  type PatternRow,
} from '@/engine/catchReport';
import { Section } from '@/components/Section';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

interface Props {
  catches: CatchRecord[];
  /** 7-day forecast from the Plan tab's last analysis, if any. */
  forecast: Conditions[] | null;
}

export function CatchReportCard({ catches, forecast }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const report = buildCatchReport(catches);
  const unlocked = report.patterns.length > 0;
  const matches =
    unlocked && forecast ? matchUpcomingDays(catches, forecast) : [];

  return (
    <Section title="Your Patterns">
      {!unlocked ? (
        <>
          <Text style={styles.para}>
            Log catches with conditions attached and bayLURE finds your
            patterns — what pressure, sky, wind, and water temperature you
            actually catch fish in.
          </Text>
          <View style={styles.progressRow}>
            {Array.from({ length: report.needed }, (_, i) => (
              <View
                key={i}
                style={[styles.progressDot, i < report.tagged && styles.progressDotOn]}
              />
            ))}
            <Text style={styles.progressText}>
              {report.tagged} of {report.needed} catches with conditions
            </Text>
          </View>
          {report.total > report.tagged ? (
            <Text style={styles.hint}>
              {report.total - report.tagged} of your catches have no conditions
              attached — run an analysis on the Plan tab before logging, and the
              snapshot is saved automatically.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={styles.para}>
            From {report.tagged} catches with conditions, you catch fish when
            it looks like this:
          </Text>
          {report.patterns.map((p) => (
            <Pattern key={p.key} row={p} />
          ))}

          <Text style={styles.subhead}>Days ahead that fish like your catches</Text>
          {!forecast ? (
            <Text style={styles.hint}>
              Analyze your spot on the Plan tab, then check back here — bayLURE
              will flag the coming days that match these patterns.
            </Text>
          ) : matches.length === 0 ? (
            <Text style={styles.hint}>
              None of the next {forecast.length} days closely match your logged
              conditions. Keep logging — more catches means more days can match.
            </Text>
          ) : (
            matches.map((m) => (
              <View key={m.date} style={styles.dayRow}>
                <View style={styles.dayHead}>
                  <Feather name="calendar" size={15} color={colors.accent} />
                  <Text style={styles.dayLabel}>{m.label}</Text>
                  <Text style={styles.dayMatches}>
                    matches {m.matches} {m.matches === 1 ? 'catch' : 'catches'}
                  </Text>
                </View>
                {m.reasons.length ? (
                  <View style={styles.chipWrap}>
                    {m.reasons.map((r) => (
                      <View key={r} style={styles.chip}>
                        <Text style={styles.chipText}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {m.avgBite !== null ? (
                  <Text style={styles.biteHint}>
                    Your matched catches came at bite score ~{m.avgBite}.
                  </Text>
                ) : null}
              </View>
            ))
          )}
          <Text style={styles.footer}>
            Every catch you log with conditions sharpens this report.
          </Text>
        </>
      )}
    </Section>
  );
}

function Pattern({ row }: { row: PatternRow }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const frac = row.total > 0 ? row.count / row.total : 0;
  return (
    <View style={styles.patternRow}>
      <View style={styles.patternIcon}>
        <Feather name={row.icon as keyof typeof Feather.glyphMap} size={14} color={colors.accent} />
      </View>
      <View style={styles.patternBody}>
        <View style={styles.patternTop}>
          <Text style={styles.patternText}>{row.text}</Text>
          <Text style={styles.patternCount}>
            {row.count} of {row.total}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(frac * 100)}%` }]} />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  para: {
    color: c.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  hint: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: c.accent,
    backgroundColor: 'transparent',
  },
  progressDotOn: {
    backgroundColor: c.accent,
  },
  progressText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
  patternRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  patternIcon: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: c.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternBody: { flex: 1 },
  patternTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  patternText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
  },
  patternCount: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: c.chip,
    marginTop: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  subhead: {
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  dayRow: {
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '800',
  },
  dayMatches: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    backgroundColor: c.chip,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  chipText: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  biteHint: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
  footer: {
    color: c.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
}));
