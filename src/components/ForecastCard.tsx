import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Conditions, Strategy } from '@/types';
import { Section } from '@/components/Section';
import { tideAt } from '@/api/tides';
import { hourLabel } from '@/utils/dates';
import { fonts, makeStyles, pressedStyle, radius, scoreColor, spacing, useTheme } from '@/theme';

const BAR_MAX = 60;

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
  onSelectDay: (index: number) => void;
  /** Index into the day's hours, or null for the whole-day overview. */
  selectedHour: number | null;
  onSelectHour: (hour: number | null) => void;
  /** Opens the tide + bite graph (shown only when the spot has a tide station). */
  onShowTideGraph?: () => void;
  /** Anchor for the host's jump button: the "Pick a day" section, so a jump
   * lands on the day picker + conditions rather than the score header. */
  pickDayRef?: React.RefObject<View | null>;
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
 * One container that merges the old Bite Forecast, 7-Day Outlook, and Conditions
 * cards. The day strip and the (tappable) hourly bite chart sit together, so a
 * day and an hour can be chosen side by side; the conditions grid below reflects
 * whatever day + hour is selected.
 */
export function ForecastCard({
  strategy,
  conditions,
  days,
  selectedDay,
  onSelectDay,
  selectedHour,
  onSelectHour,
  onShowTideGraph,
  pickDayRef,
}: Props) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const { water, chartedDepth } = conditions;
  const hours = conditions.hourlyWeather;

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

  return (
    <Section
      title="Forecast"
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
            { width: `${strategy.biteScore}%`, backgroundColor: scoreColor(strategy.biteScore) },
          ]}
        />
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

      <View style={styles.divider} />

      {/* Day picker — the wrapper is the jump button's landing anchor. */}
      <View ref={pickDayRef} collapsable={false}>
        <Text style={styles.subhead}>Pick a day</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
      >
        {days.map((d, i) => {
          const active = i === selectedDay;
          return (
            <Pressable
              key={i}
              onPress={() => onSelectDay(i)}
              style={({ pressed }) => [
                styles.day,
                active && styles.dayActive,
                pressed && pressedStyle,
              ]}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{d.label}</Text>
              <Text style={[styles.dayNum, active && styles.dayLabelActive]}>{d.num}</Text>
              <View style={[styles.dayPill, { backgroundColor: scoreColor(d.score) }]}>
                <Text style={styles.dayPillText}>{d.score}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {conditions.tide && onShowTideGraph ? (
        <Pressable
          onPress={onShowTideGraph}
          style={({ pressed }) => [styles.tideBtn, pressed && pressedStyle]}
        >
          <LinearGradient
            colors={gradients.button}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.tideBtnFill}
          >
            <Feather name="bar-chart-2" size={17} color={colors.onAccent} />
            <Text style={styles.tideBtnText}>Tides & Bite Graph</Text>
            <Feather name="chevron-right" size={17} color={colors.onAccent} />
          </LinearGradient>
        </Pressable>
      ) : null}

      {strategy.bestWindows.length > 0 ? (
        <View style={styles.windows}>
          <Text style={styles.subhead}>Best bite times</Text>
          {strategy.bestWindows.map((win, i) => (
            <View key={i} style={styles.window}>
              <Feather name="crosshair" size={14} color={colors.accent} style={styles.target} />
              <Text style={styles.windowRange}>{win.range}</Text>
              <View style={[styles.windowPill, { backgroundColor: scoreColor(win.score) }]}>
                <Text style={styles.windowPillText}>{win.biteLabel}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Hour picker = tappable hourly bite chart */}
      {hours.length > 0 ? (
        <View>
          <View style={styles.hourHead}>
            <Text style={styles.subhead}>Pick an hour</Text>
            <Pressable
              onPress={() => onSelectHour(null)}
              style={({ pressed }) => [
                styles.allday,
                selectedHour == null && styles.alldayActive,
                pressed && pressedStyle,
              ]}
            >
              <Text style={[styles.alldayText, selectedHour == null && styles.alldayTextActive]}>
                All day
              </Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chart}
          >
            {strategy.hourly.map((h, i) => {
              const active = i === selectedHour;
              return (
                <Pressable
                  key={i}
                  onPress={() => onSelectHour(i)}
                  style={({ pressed }) => [
                    styles.col,
                    !h.isDay && !active && styles.night,
                    active && styles.colActive,
                    pressed && pressedStyle,
                  ]}
                >
                  <Text style={styles.colScore}>{h.score}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.hbar,
                        {
                          height: Math.max(4, (h.score / 100) * BAR_MAX),
                          backgroundColor: scoreColor(h.score),
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.colLabel, active && styles.colLabelActive]}>{h.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Conditions for the selected day + hour */}
      <Text style={styles.condHead}>Conditions · {whenText}</Text>
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

      <Text style={styles.hint}>
        Tap a day, then an hour to see the bite and conditions for that moment.
        Bite is graded hour by hour (night dimmed); peaks usually fall around
        dawn and dusk. Future days are forecasts.
      </Text>
    </Section>
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
  // Bite headline
  score: { fontFamily: fonts.displayBold, fontSize: 32 },
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

  divider: { height: 1, backgroundColor: colors.cardBorder, marginVertical: spacing.md },
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
  subhead: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },

  // Day strip
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

  // Tide graph opener — the same foliage-green gradient as the primary
  // "Analyze my spot" button, so the two read as one system.
  tideBtn: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    shadowColor: colors.accentDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34,
    shadowRadius: 9,
    elevation: 5,
  },
  tideBtnFill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  tideBtnText: { flex: 1, color: colors.onAccent, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  // Best windows
  windows: { gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  window: { flexDirection: 'row', alignItems: 'center' },
  target: { fontSize: 14, marginRight: spacing.sm },
  windowRange: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  windowPill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 10 },
  windowPillText: { color: '#0e1f12', fontSize: 12, fontWeight: '900' },

  // Hourly chart / hour picker
  hourHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  allday: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: spacing.sm,
  },
  alldayActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  alldayText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  alldayTextActive: { color: colors.text },
  chart: { gap: spacing.sm, alignItems: 'flex-end', paddingVertical: spacing.xs },
  col: { width: 36, alignItems: 'center', paddingVertical: 4, borderRadius: radius.sm },
  colActive: { backgroundColor: colors.accentDim },
  night: { opacity: 0.45 },
  colScore: { color: colors.textMuted, fontSize: 10, fontWeight: '700', marginBottom: 2 },
  barTrack: { height: BAR_MAX, justifyContent: 'flex-end' },
  hbar: { width: 16, borderRadius: 4 },
  colLabel: { color: colors.textMuted, fontSize: 9, marginTop: 4 },
  colLabelActive: { color: colors.text, fontWeight: '700' },

  // Conditions grid
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

  // AI + hint
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
  hint: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: spacing.md },
}));
