import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  Conditions,
  StructureType,
  Strategy,
  WaterType,
} from '@/types';
import { getCurrentLocation } from '@/api/location';
import { gatherConditions } from '@/api/conditions';
import { buildStrategy } from '@/engine/strategy';
import { ConditionsCard } from '@/components/ConditionsCard';
import { StrategyCard } from '@/components/StrategyCard';
import { WaterTypeToggle } from '@/components/WaterTypeToggle';
import { StructurePicker } from '@/components/StructurePicker';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

export function HomeScreen() {
  const [waterType, setWaterType] = useState<WaterType>('freshwater');
  const [structures, setStructures] = useState<StructureType[]>(['vegetation']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [place, setPlace] = useState<string>('');

  const toggleStructure = useCallback((value: StructureType) => {
    setStructures((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value],
    );
  }, []);

  const onAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setPlace(loc.label);
      const next = await gatherConditions({
        coordinates: loc.coordinates,
        waterType,
        structures,
      });
      setConditions(next);
      setStrategy(buildStrategy(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [waterType, structures]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>BALURE</Text>
      <Text style={styles.tagline}>
        Read the conditions. Tie on the right thing.
      </Text>

      <Section title="Your Spot">
        <WaterTypeToggle value={waterType} onChange={setWaterType} />
        <Text style={styles.fieldLabel}>Structure & cover you can see</Text>
        <StructurePicker selected={structures} onToggle={toggleStructure} />
      </Section>

      <Pressable
        onPress={onAnalyze}
        disabled={loading}
        style={[styles.cta, loading && styles.ctaDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.ctaText}>Analyze my spot</Text>
        )}
      </Pressable>

      {place ? <Text style={styles.place}>📍 {place}</Text> : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {conditions ? <ConditionsCard conditions={conditions} /> : null}
      {strategy ? <StrategyCard strategy={strategy} /> : null}

      {!conditions && !loading && !error ? (
        <Text style={styles.hint}>
          Pick your water type and the cover you're fishing, then tap Analyze.
          BALURE pulls live weather, water temperature{' '}
          {waterType === 'saltwater' ? 'and NOAA tides ' : ''}
          for your GPS location and builds a game plan.
        </Text>
      ) : null}

      <Text style={styles.footer}>
        Recommendations are guidance from live conditions — local knowledge and
        regulations always win. Tight lines.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
  brand: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 4,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  place: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: '#3a1f1f',
    borderColor: colors.bad,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#f4c4ba',
    fontSize: 13,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  footer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.lg,
    opacity: 0.7,
  },
});
