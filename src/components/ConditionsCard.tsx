import { StyleSheet, Text, View } from 'react-native';
import type { Conditions } from '@/types';
import { Section } from '@/components/Section';
import { colors, spacing } from '@/theme';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

const trendArrow: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  steady: '→',
  unknown: '·',
};

export function ConditionsCard({ conditions }: { conditions: Conditions }) {
  const { weather: w, water, tide } = conditions;

  return (
    <Section title="Conditions">
      <View style={styles.grid}>
        <Stat label="Air" value={`${w.airTempF}°F`} />
        <Stat
          label="Water"
          value={`${water.waterTempF}°F`}
          hint={water.isEstimated ? 'estimated' : 'measured'}
        />
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
        <Stat label="Humidity" value={`${w.humidityPct}%`} hint={w.weatherLabel} />
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

const styles = StyleSheet.create({
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
});
