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
  Coordinates,
  Species,
  StructureType,
  Strategy,
  WaterType,
} from '@/types';
import { getCurrentLocation, reverseGeocode } from '@/api/location';
import { gatherConditions } from '@/api/conditions';
import { buildStrategy } from '@/engine/strategy';
import { speciesForWaterType } from '@/engine/species';
import { ConditionsCard } from '@/components/ConditionsCard';
import { StrategyCard } from '@/components/StrategyCard';
import { WaterTypeToggle } from '@/components/WaterTypeToggle';
import {
  StructurePicker,
  structuresForWaterType,
} from '@/components/StructurePicker';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { MapPicker } from '@/components/MapPicker';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

export function HomeScreen() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [place, setPlace] = useState<string>('');
  const [locating, setLocating] = useState(false);

  const [waterType, setWaterType] = useState<WaterType>('freshwater');
  const [species, setSpecies] = useState<Species>('any');
  const [structures, setStructures] = useState<StructureType[]>(['vegetation']);

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Keep cover and species valid for the chosen water type when it changes.
  const onChangeWaterType = useCallback((next: WaterType) => {
    setWaterType(next);
    const allowed = structuresForWaterType(next);
    setStructures((prev) => {
      const kept = prev.filter((s) => allowed.includes(s));
      return kept.length > 0 ? kept : allowed.slice(0, 1);
    });
    setSpecies((prev) =>
      prev === 'any' || speciesForWaterType(next).some((s) => s.id === prev)
        ? prev
        : 'any',
    );
  }, []);

  const toggleStructure = useCallback((value: StructureType) => {
    setStructures((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value],
    );
  }, []);

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setCoordinates(loc.coordinates);
      setPlace(loc.label || formatCoords(loc.coordinates));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get your location.');
    } finally {
      setLocating(false);
    }
  }, []);

  const onPickOnMap = useCallback((coords: Coordinates) => {
    setCoordinates(coords);
    setPlace(formatCoords(coords));
    setError(null);
    // Try to upgrade the raw coords to a place name (native only).
    void reverseGeocode(coords).then((label) => {
      if (label) setPlace(label);
    });
  }, []);

  const onAnalyze = useCallback(async () => {
    if (!coordinates) return;
    setAnalyzing(true);
    setError(null);
    try {
      const next = await gatherConditions({
        coordinates,
        waterType,
        species,
        structures,
      });
      setConditions(next);
      setStrategy(buildStrategy(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAnalyzing(false);
    }
  }, [coordinates, waterType, species, structures]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>BALURE</Text>
      <Text style={styles.tagline}>Read the water. Tie on the right thing.</Text>

      {/* Step 1 — Location */}
      <Section title="1 · Location">
        <Pressable
          onPress={useMyLocation}
          disabled={locating}
          style={[styles.secondaryBtn, locating && styles.btnDisabled]}
        >
          {locating ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.secondaryBtnText}>📍 Use my location</Text>
          )}
        </Pressable>

        <Text style={styles.orLabel}>or drop a pin on the map</Text>
        <MapPicker center={coordinates} onPick={onPickOnMap} height={220} />

        <Text style={styles.selected}>
          {coordinates
            ? `Spot set — ${place}`
            : 'No spot selected yet.'}
        </Text>
      </Section>

      {/* Step 2 — Water type */}
      <Section title="2 · Water Type">
        <WaterTypeToggle value={waterType} onChange={onChangeWaterType} />
      </Section>

      {/* Step 3 — Target species */}
      <Section title="3 · Target Species">
        <Text style={styles.helper}>
          Pick a fish to sharpen the picks, or leave it on Any.
        </Text>
        <SpeciesPicker
          waterType={waterType}
          value={species}
          onChange={setSpecies}
        />
      </Section>

      {/* Step 4 — Structure & cover (filtered to the water type) */}
      <Section title="4 · Structure & Cover">
        <Text style={styles.helper}>
          Tap everything you can see at your spot.
        </Text>
        <StructurePicker
          waterType={waterType}
          selected={structures}
          onToggle={toggleStructure}
        />
      </Section>

      <Pressable
        onPress={onAnalyze}
        disabled={analyzing || !coordinates}
        style={[
          styles.cta,
          (analyzing || !coordinates) && styles.btnDisabled,
        ]}
      >
        {analyzing ? (
          <ActivityIndicator color={colors.card} />
        ) : (
          <Text style={styles.ctaText}>
            {coordinates ? 'Analyze my spot' : 'Set a location first'}
          </Text>
        )}
      </Pressable>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {conditions ? <ConditionsCard conditions={conditions} /> : null}
      {strategy ? <StrategyCard strategy={strategy} /> : null}

      {!conditions && !analyzing && !error ? (
        <Text style={styles.hint}>
          Set your spot, choose your water, and tell BALURE the cover you see.
          It pulls live weather, water temperature
          {waterType === 'saltwater' ? ' and NOAA tides ' : ' '}
          for that location and builds a game plan with the lures, rigs, and
          bait to throw.
        </Text>
      ) : null}

      <Text style={styles.footer}>
        Recommendations are guidance from live conditions — local knowledge and
        regulations always win. Tight lines.
      </Text>
    </ScrollView>
  );
}

function formatCoords(c: Coordinates): string {
  return `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;
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
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  secondaryBtn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  orLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: spacing.sm,
  },
  selected: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: colors.card,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderColor: colors.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.errorText,
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
    opacity: 0.8,
  },
});
