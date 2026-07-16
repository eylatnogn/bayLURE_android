import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Polyline, Rect as SvgRect } from 'react-native-svg';
import type { Conditions, Strategy } from '@/types';
import { DEFAULT_METRIC_ORDER, METRICS, type MetricKey } from '@/config/metrics';
import { Section } from '@/components/Section';
import { DetailSheet } from '@/components/DetailSheet';
import { ReorderableStrip } from '@/components/ReorderableStrip';
import { tideAt } from '@/api/tides';
import { hourLabel } from '@/utils/dates';
import { fonts, makeStyles, pressedStyle, radius, scoreColor, spacing, useTheme } from '@/theme';

export interface OutlookDay {
  label: string;
  num: string;
  score: number;
}

interface Props {
  strategy: Strategy;
  conditions: Conditions;
  days: OutlookDay[];
  selectedDay: number;
  /** Index into the day's hours, or null for the whole-day overview. Set from
   * the graph sheet; the conditions strip reflects it. */
  selectedHour: number | null;
  /** Opens the tide + bite graph — where the day, hour, and best times live. */
  onShowTideGraph?: () => void;
  /** Opens the "Why they're biting" detail sheet from the score's "Why" link. */
  onShowWhy?: () => void;
  /** Anchor for the host's jump button: the bite hero, so a jump lands on the
   * score + conditions rather than the score header. */
  pickDayRef?: React.RefObject<View | null>;
  /** The angler's chosen order for the conditions strip (see config/metrics).
   * Defaults to the standard order when not set. */
  metricOrder?: MetricKey[];
  /** Persist a new strip order (from dragging the tiles in reorder mode). */
  onReorderMetrics?: (order: MetricKey[]) => void;
}

const trendArrow: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  steady: '→',
  unknown: '·',
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * The Plan tab's result summary: a bite-score hero, a scrollable strip of the
 * five key conditions (tap "More" for the full grid), and the graph feature
 * tile. Day and hour picking, best bite times, and the hourly chart live in
 * the graph sheet the tile opens — so the main page stays a scannable
 * dashboard and detail is one tap away.
 */
export function ForecastCard({
  strategy,
  conditions,
  days,
  selectedDay,
  selectedHour,
  onShowTideGraph,
  onShowWhy,
  pickDayRef,
  metricOrder = DEFAULT_METRIC_ORDER,
  onReorderMetrics,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { water, chartedDepth } = conditions;
  // Drag-to-reorder mode for the conditions strip (tap the reorder icon).
  const [reordering, setReordering] = useState(false);
  const hours = conditions.hourlyWeather;
  // Full conditions grid lives one tap away, behind the "More" chip.
  const [condOpen, setCondOpen] = useState(false);

  // Active weather: the selected hour, or the day's representative snapshot.
  const w =
    selectedHour != null ? hours[selectedHour] ?? conditions.weather : conditions.weather;

  // Tide drifts through the day, so recompute it at the selected hour; the
  // day overview keeps the snapshot computed for "now" / midday.
  const tide =
    conditions.tide && selectedHour != null
      ? { ...conditions.tide, ...tideAt(conditions.tide.events, new Date(w.timeISO).getTime()) }
      : conditions.tide;

  const dayText = days[selectedDay]?.label ?? '';
  const whenText =
    selectedHour != null ? `${dayText} · ${hourLabel(w.timeISO)}` : `${dayText} · all day`;

  // Lightning is a get-off-the-water hazard — call out the day's storm hours.
  const thunderHours = hours.filter((h) => h.thunder);
  const thunderRange =
    thunderHours.length > 0
      ? thunderHours.length === 1
        ? `around ${hourLabel(thunderHours[0]!.timeISO)}`
        : `${hourLabel(thunderHours[0]!.timeISO)} – ${hourLabel(thunderHours[thunderHours.length - 1]!.timeISO)}`
      : null;

  const barColor = scoreColor(strategy.biteScore);
  const trend = trendArrow[w.pressureTrend] ?? '';

  // The key conditions, scrollable across; the rest are in the "More" sheet.
  // Content and default order live in config/metrics; the angler's saved order
  // (metricOrder) decides which they see first. Icons echo the fuller grid.
  const metricCtx = { w, water, trend };
  const condChips = metricOrder.map((k) => METRICS[k]);

  return (
    <>
      <Text style={styles.sectionLabel}>Bite</Text>
      <View ref={pickDayRef} collapsable={false} style={styles.heroCard}>
        <View style={styles.heroRow}>
          <Text style={[styles.scoreBig, { color: barColor }]}>{strategy.biteScore}</Text>
          <View style={styles.heroBody}>
            <View style={styles.heroLabelRow}>
              <Text style={[styles.biteLabel, { color: barColor }]} numberOfLines={1}>
                {strategy.biteLabel}
              </Text>
              {onShowWhy ? (
                <Pressable
                  onPress={onShowWhy}
                  hitSlop={8}
                  style={({ pressed }) => (pressed ? pressedStyle : undefined)}
                >
                  <View style={styles.whyRow}>
                    <Text style={styles.whyText}>Why</Text>
                    <Feather name="chevron-right" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${strategy.biteScore}%`, backgroundColor: barColor }]} />
            </View>
          </View>
        </View>
        <Text style={styles.summary}>{strategy.summary}</Text>

        {thunderRange ? (
          <View style={styles.thunder}>
            <Feather name="zap" size={15} color={colors.warn} />
            <Text style={styles.thunderText}>
              Thunderstorms forecast {thunderRange}{' '}
              ({dayText === 'Tom' ? 'tomorrow' : dayText.toLowerCase()}) —
              lightning and open water don't mix. Plan around it.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Conditions — key chips scroll across; "More" opens the full grid, and
          the reorder icon drops the tiles into drag-to-reorder mode. */}
      {reordering ? (
        <View style={styles.reorderWrap}>
          <View style={styles.reorderHead}>
            <Text style={styles.reorderHint}>Drag the tiles to reorder</Text>
            <Pressable
              onPress={() => setReordering(false)}
              hitSlop={8}
              style={({ pressed }) => [styles.doneBtn, pressed && pressedStyle]}
            >
              <Feather name="check" size={13} color={colors.accent} />
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>
          <ReorderableStrip
            items={condChips}
            keyOf={(chip) => chip.key}
            height={52}
            onReorder={(list) => onReorderMetrics?.(list.map((chip) => chip.key))}
            renderItem={(chip, dragging) => (
              <View style={[styles.reorderTile, dragging && styles.reorderTileActive]}>
                <Feather
                  name={chip.icon}
                  size={14}
                  color={dragging ? colors.accent : colors.text}
                />
                <Text style={styles.reorderTileLabel} numberOfLines={1}>
                  {chip.label}
                </Text>
              </View>
            )}
          />
        </View>
      ) : (
        <View style={styles.condRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.condStrip}
          >
            {condChips.map((chip) => (
              <View key={chip.key} style={styles.condChip}>
                <Text style={styles.condChipValue}>{chip.value(metricCtx)}</Text>
                <View style={styles.condChipLabelRow}>
                  <Feather name={chip.icon} size={11} color={colors.textMuted} />
                  <Text style={styles.condChipLabel}>{chip.label}</Text>
                </View>
              </View>
            ))}
            <Pressable
              onPress={() => setCondOpen(true)}
              style={({ pressed }) => [styles.moreChip, pressed && pressedStyle]}
            >
              <Text style={styles.moreChipText}>More</Text>
              <Feather name="chevron-right" size={13} color={colors.accent} />
            </Pressable>
          </ScrollView>
          {onReorderMetrics ? (
            <Pressable
              onPress={() => setReordering(true)}
              hitSlop={8}
              accessibilityLabel="Reorder conditions"
              style={({ pressed }) => [styles.reorderBtn, pressed && pressedStyle]}
            >
              <Feather name="move" size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {onShowTideGraph ? (
        <>
          <Text style={styles.sectionLabel}>Plan</Text>
          <Pressable
            onPress={onShowTideGraph}
            style={({ pressed }) => [styles.featureTile, pressed && pressedStyle]}
          >
            <Svg width={64} height={38} viewBox="0 0 64 38">
              <SvgRect x={2} y={26} width={6} height={9} rx={1} fill={colors.accent} opacity={0.7} />
              <SvgRect x={17} y={20} width={6} height={15} rx={1} fill={colors.accent} opacity={0.7} />
              <SvgRect x={32} y={16} width={6} height={19} rx={1} fill={colors.accent} opacity={0.7} />
              <SvgRect x={47} y={23} width={6} height={12} rx={1} fill={colors.accent} opacity={0.7} />
              <Polyline
                points="0,28 12,16 24,20 36,8 48,13 64,22"
                fill="none"
                stroke={colors.water}
                strokeWidth={2.2}
              />
            </Svg>
            <View style={styles.featureBody}>
              {/* Freshwater has no tide station, but the hourly weather/bite
                  charts still work — the sheet opens on the air-temp chart. */}
              <Text style={styles.featureTitle}>
                {conditions.tide ? 'Tides & Bite Graph' : 'Hourly & Bite Graph'}
              </Text>
              <Text style={styles.featureSub}>Hourly bite, tide, and every condition</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textMuted} />
          </Pressable>
        </>
      ) : null}

      {/* Full conditions grid — one tap from the "More" chip. */}
      <DetailSheet visible={condOpen} onClose={() => setCondOpen(false)}>
        <Section title={`Conditions · ${whenText}`}>
          <View style={styles.grid}>
            <Stat label="Air" value={`${w.airTempF}°F`} />
            <Stat
              label="Water"
              value={`${water.waterTempF}°F`}
              hint={water.isEstimated ? 'estimated' : 'measured'}
            />
            {chartedDepth ? (
              <Stat label="Depth" value={`≈${chartedDepth.depthFt} ft`} hint="charted bottom" />
            ) : null}
            <Stat
              label="Pressure"
              value={`${w.pressureInHg}"`}
              hint={`${trendArrow[w.pressureTrend] ?? '·'} ${w.pressureTrend}`}
            />
            <Stat
              label="Wind"
              value={`${w.windMph} mph`}
              hint={`${w.windDirectionLabel} · g${w.windGustMph}`}
            />
            <Stat label="Sky" value={skyShort(w.sky)} hint={`${w.cloudCoverPct}% cloud`} />
            <Stat
              label="Rain"
              value={`${w.precipChancePct}%`}
              hint={w.thunder ? '⚡ thunderstorms' : w.precipChancePct >= 35 ? w.weatherLabel : 'chance'}
            />
            <Stat label="Clarity" value={cap(conditions.clarity)} />
            <Stat label="Humidity" value={`${w.humidityPct}%`} hint={w.weatherLabel} />
            <Stat label="Sunrise" value={w.sunrise} />
            <Stat label="Sunset" value={w.sunset} />
            <Stat
              label="Moon"
              value={`${w.moonIllumPct}%`}
              hint={w.moonMajor ? `${w.moonPhase} ◆` : w.moonPhase}
            />
            {water.waveHeightFt != null ? (
              <Stat label="Waves" value={`${water.waveHeightFt} ft`} />
            ) : null}
            {tide ? (
              <Stat
                label="Tide"
                value={cap(tide.state)}
                hint={tide.nextEvent ? `${tide.nextEvent.type} ${shortTime(tide.nextEvent.time)}` : undefined}
              />
            ) : null}
          </View>

          {tide ? (
            <Text style={styles.meta}>
              NOAA station {tide.stationName} · {tide.stationDistanceMi} mi away
            </Text>
          ) : null}
          <Text style={styles.meta}>
            {chartedDepth
              ? `Charted bottom depth from ${chartedDepth.source}`
              : 'No charted bottom depth here — your selected depth zone still guides the picks.'}
          </Text>

          {strategy.aiNarrative ? (
            <View style={styles.ai}>
              <Text style={styles.aiLabel}>GUIDE'S TAKE (AI)</Text>
              <Text style={styles.aiText}>{strategy.aiNarrative}</Text>
            </View>
          ) : null}
        </Section>
      </DetailSheet>
    </>
  );
}

function skyShort(sky: Conditions['weather']['sky']): string {
  if (sky === 'partly_cloudy') return 'P. Cloudy';
  return cap(sky);
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function shortTime(iso: string): string {
  // NOAA returns "YYYY-MM-DD HH:mm"; show HH:mm.
  const parts = iso.split(' ');
  return parts[1] ?? iso;
}

const useStyles = makeStyles((colors) => ({
  // Section eyebrow labels ("Bite", "Plan").
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  // Bite hero
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreBig: { fontFamily: fonts.displayBold, fontSize: 46, lineHeight: 50 },
  heroBody: { flex: 1 },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  biteLabel: { fontSize: 16, fontWeight: '800', flex: 1 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  whyText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: spacing.md },

  thunder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  thunderText: { flex: 1, color: colors.errorText, fontSize: 12, lineHeight: 17, fontWeight: '600' },

  // Conditions chip strip
  condRow: { flexDirection: 'row', alignItems: 'center' },
  condStrip: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.xs },
  // Reorder toggle sitting at the right end of the strip row.
  reorderBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  reorderWrap: { paddingVertical: spacing.xs },
  reorderHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reorderHint: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  doneText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  reorderTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    marginHorizontal: 3,
    alignSelf: 'stretch',
  },
  reorderTileActive: {
    borderColor: colors.accent,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  reorderTileLabel: { color: colors.text, fontSize: 11, fontWeight: '700' },
  condChip: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 66,
  },
  condChipValue: { color: colors.text, fontSize: 15, fontWeight: '700' },
  condChipLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  condChipLabel: { color: colors.textMuted, fontSize: 10 },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  moreChipText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  // Graph feature tile
  featureTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  featureBody: { flex: 1 },
  featureTitle: { color: colors.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  featureSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  // Conditions grid (in the "More" sheet)
  condHead: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '25%', marginBottom: spacing.md },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statHint: { color: colors.accent, fontSize: 10, marginTop: 1 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: spacing.xs },

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
}));
