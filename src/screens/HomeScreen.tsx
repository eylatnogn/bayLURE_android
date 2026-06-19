import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  CatchConditions,
  Conditions,
  Coordinates,
  PressureLevel,
  Species,
  StructureType,
  Strategy,
  WaterClarity,
  WaterType,
} from '@/types';
import { getCurrentLocation, reverseGeocode } from '@/api/location';
import { geocodeQuery, reverseRegion, type Region } from '@/api/geocode';
import { gatherConditions } from '@/api/conditions';
import { fetchAreaFish, type AreaFish } from '@/api/areaSpecies';
import { buildStrategy } from '@/engine/strategy';
import { speciesForWaterType, SPECIES } from '@/engine/species';
import { buildCatchConditions } from '@/utils/snapshot';
import { ConditionsCard } from '@/components/ConditionsCard';
import { AreaFishCard } from '@/components/AreaFishCard';
import { RegulationsCard } from '@/components/RegulationsCard';
import { StrategyCard } from '@/components/StrategyCard';
import { WaterTypeToggle } from '@/components/WaterTypeToggle';
import {
  StructurePicker,
  structuresForWaterType,
} from '@/components/StructurePicker';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { MapPicker } from '@/components/MapPicker';
import { Section } from '@/components/Section';
import { APP_VERSION } from '@/version';
import { colors, radius, spacing } from '@/theme';

interface Props {
  /** Called after an analysis so the catch log can attach these conditions. */
  onSnapshot?: (snapshot: CatchConditions) => void;
}

export function HomeScreen({ onSnapshot }: Props) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [place, setPlace] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const [waterType, setWaterType] = useState<WaterType>('freshwater');
  const [species, setSpecies] = useState<Species>('any');
  const [structures, setStructures] = useState<StructureType[]>(['vegetation']);
  const [pressureLevel, setPressureLevel] = useState<PressureLevel>('none');
  const [clarity, setClarity] = useState<WaterClarity>('stained');

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [areaFish, setAreaFish] = useState<AreaFish[]>([]);
  const [region, setRegion] = useState<Region | null>(null);

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

  const onFindAddress = useCallback(async () => {
    if (!query.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      const hit = await geocodeQuery(query);
      if (!hit) {
        setError(`Couldn't find "${query.trim()}". Try a ZIP code or "City, State".`);
        return;
      }
      setCoordinates(hit.coordinates);
      setPlace(hit.label || formatCoords(hit.coordinates));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Address lookup failed.');
    } finally {
      setGeocoding(false);
    }
  }, [query]);

  const onPickTarget = useCallback(
    (sp: Species) => {
      const info = SPECIES.find((s) => s.id === sp);
      if (info) onChangeWaterType(info.waterType);
      setSpecies(sp);
    },
    [onChangeWaterType],
  );

  const onAnalyze = useCallback(async () => {
    if (!coordinates) return;
    setAnalyzing(true);
    setError(null);
    try {
      const [next, fish, reg] = await Promise.all([
        gatherConditions({
          coordinates,
          waterType,
          species,
          structures,
          pressureLevel,
          clarity,
        }),
        fetchAreaFish(coordinates).catch(() => [] as AreaFish[]),
        reverseRegion(coordinates).catch(() => null),
      ]);
      const strat = buildStrategy(next);
      setConditions(next);
      setStrategy(strat);
      setAreaFish(fish);
      setRegion(reg);
      onSnapshot?.(buildCatchConditions(next, strat.biteScore, place));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAnalyzing(false);
    }
  }, [coordinates, waterType, species, structures, pressureLevel, clarity, place, onSnapshot]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brandRow}>
        <Text style={styles.brand}>bayLURE</Text>
        <Text style={styles.version}>v{APP_VERSION}</Text>
      </View>
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

        <Text style={styles.orLabel}>or enter an address or ZIP code</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={onFindAddress}
            placeholder="e.g. 30301 or Lake Lanier, GA"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            returnKeyType="search"
            style={styles.input}
          />
          <Pressable
            onPress={onFindAddress}
            disabled={geocoding || !query.trim()}
            style={[
              styles.findBtn,
              (geocoding || !query.trim()) && styles.btnDisabled,
            ]}
          >
            {geocoding ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.findBtnText}>Find</Text>
            )}
          </Pressable>
        </View>

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

      {/* Step 3 — Water clarity */}
      <Section title="3 · Water Clarity">
        <Text style={styles.helper}>
          How far can you see into the water? It drives color, vibration, and how
          the fish hunt.
        </Text>
        <View style={styles.toggleRow}>
          {([
            { value: 'clear', label: 'Clear' },
            { value: 'stained', label: 'Stained' },
            { value: 'muddy', label: 'Muddy' },
          ] as const).map((opt) => {
            const active = clarity === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setClarity(opt.value)}
                style={[styles.togglePill, active && styles.togglePillActive]}
              >
                <Text
                  style={[
                    styles.togglePillText,
                    active && styles.togglePillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Step 4 — Target species */}
      <Section title="4 · Target Species">
        <Text style={styles.helper}>
          Pick a fish to sharpen the picks, or leave it on Any.
        </Text>
        <SpeciesPicker
          waterType={waterType}
          value={species}
          onChange={setSpecies}
        />
      </Section>

      {/* Step 5 — Structure & cover (filtered to the water type) */}
      <Section title="5 · Structure & Cover">
        <Text style={styles.helper}>
          Tap everything you can see at your spot.
        </Text>
        <StructurePicker
          waterType={waterType}
          selected={structures}
          onToggle={toggleStructure}
        />
      </Section>

      {/* Step 6 — Fishing pressure */}
      <Section title="6 · Fishing Pressure">
        <Text style={styles.helper}>
          How heavily fished is this water? More boats, docks, and popular bank
          spots mean warier fish — bayLURE scales the finesse plan to match.
        </Text>
        <View style={styles.toggleRow}>
          {([
            { value: 'none', label: 'Light' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'Heavy' },
          ] as const).map((opt) => {
            const active = pressureLevel === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setPressureLevel(opt.value)}
                style={[styles.togglePill, active && styles.togglePillActive]}
              >
                <Text
                  style={[
                    styles.togglePillText,
                    active && styles.togglePillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
      {strategy ? <RegulationsCard region={region} /> : null}
      {areaFish.length > 0 ? (
        <AreaFishCard fish={areaFish} onPickTarget={onPickTarget} />
      ) : null}

      {!conditions && !analyzing && !error ? (
        <Text style={styles.hint}>
          Set your spot, choose your water, and tell bayLURE the cover you see.
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
  },
  version: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
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
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  findBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 72,
  },
  findBtnText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  togglePill: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  togglePillText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  togglePillTextActive: {
    color: colors.text,
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
