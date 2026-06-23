import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Conditions } from '@/types';
import { Section } from '@/components/Section';
import { tideAt } from '@/api/tides';
import { colors, pressedStyle, radius, spacing } from '@/theme';

interface Props {
  conditions: Conditions;
  /** Index into conditions.hourlyWeather, or null for the day overview. */
  selectedHour: number | null;
  onSelectHour: (hour: number | null) => void;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

function HourChip({
  label,
  sub,
  active,
  onPress,
}: {
  label: string;
  sub?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.hourChip,
        active && styles.hourChipActive,
        pressed && pressedStyle,
      ]}
    >
      <Text style={[styles.hourChipLabel, active && styles.hourChipLabelActive]}>
        {label}
      </Text>
      {sub ? (
        <Text style={[styles.hourChipSub, active && styles.hourChipSubActive]}>
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

const trendArrow: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  steady: '→',
  unknown: '·',
};

export function ConditionsCard({ conditions, selectedHour, onSelectHour }: Props) {
  const { water, chartedDepth } = conditions;
  const hours = conditions.hourlyWeather;

  // Weather for the chosen hour, falling back to the day's representative
  // snapshot (the "Day" overview, or if the index is somehow out of range).
  const w =
    selectedHour != null
      ? hours[selectedHour] ?? conditions.weather
      : conditions.weather;

  // Tide drifts through the day, so recompute it at the selected hour. The day
  // overview keeps the snapshot the forecast computed for "now" / midday.
  const tide =
    conditions.tide && selectedHour != null
      ? { ...conditions.tide, ...tideAt(conditions.tide.events, new Date(w.timeISO).getTime()) }
      : conditions.tide;

  const title =
    selectedHour != null ? `Conditions · ${hourLabel(w.timeISO)}` : 'Conditions';

  return (
    <Section title={title}>
      {hours.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hourStrip}
        >
          <HourChip
            label="Day"
            active={selectedHour == null}
            onPress={() => onSelectHour(null)}
          />
          {hours.map((h, i) => (
            <HourChip
              key={h.timeISO}
              label={hourLabel(h.timeISO)}
              sub={`${h.airTempF}°`}
              active={selectedHour === i}
              onPress={() => onSelectHour(i)}
            />
          ))}
        </ScrollView>
      ) : null}

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
        <Text style={styles.tideMeta}>
          NOAA station {tide.stationName} · {tide.stationDistanceMi} mi away
        </Text>
      ) : null}

      <Text style={styles.depthMeta}>
        {chartedDepth
          ? `Charted bottom depth from ${chartedDepth.source}`
          : 'No charted bottom depth here — your selected depth zone still guides the picks.'}
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

/**
 * "2026-06-22T13:00" -> "1 PM". Reads the hour straight from the ISO string so
 * the label never drifts with the device timezone.
 */
function hourLabel(iso: string): string {
  const hh = Number(iso.slice(11, 13));
  if (Number.isNaN(hh)) return iso;
  const period = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12} ${period}`;
}

const styles = StyleSheet.create({
  hourStrip: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingRight: spacing.sm,
  },
  hourChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    minWidth: 54,
  },
  hourChipActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  hourChipLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  hourChipLabelActive: {
    color: colors.text,
  },
  hourChipSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  hourChipSubActive: {
    color: colors.accent,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stat: {
    width: '25%',
    marginBottom: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statHint: {
    color: colors.accent,
    fontSize: 10,
    marginTop: 1,
  },
  tideMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  depthMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
