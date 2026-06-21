import { useCallback, useEffect, useState } from 'react';
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
  FavoriteLocation,
  PressureLevel,
  Species,
  StructureType,
  Strategy,
  WaterClarity,
  WaterDepth,
  WaterType,
} from '@/types';
import { regulationsForState } from '@/engine/regulations';
import {
  loadFavorites,
  addFavorite,
  deleteFavorite,
} from '@/storage/favorites';
import { getCurrentLocation, reverseGeocode } from '@/api/location';
import { geocodeQuery, reverseRegion, type Region } from '@/api/geocode';
import { gatherForecast } from '@/api/conditions';
import { fetchAreaFish, type AreaFish } from '@/api/areaSpecies';
import { buildStrategy } from '@/engine/strategy';
import { speciesForWaterType, SPECIES } from '@/engine/species';
import { buildCatchConditions } from '@/utils/snapshot';
import { addDays, longDayLabel, dayLabel, dayNumber } from '@/utils/dates';
import { ConditionsCard } from '@/components/ConditionsCard';
import { AreaFishCard } from '@/components/AreaFishCard';
import { RegulationsCard } from '@/components/RegulationsCard';
import { BiteForecastCard } from '@/components/BiteForecastCard';
import { OutlookCard } from '@/components/OutlookCard';
import { PicksCard } from '@/components/PicksCard';
import { InsightsCard } from '@/components/InsightsCard';
import { WaterTypeToggle } from '@/components/WaterTypeToggle';
import {
  StructurePicker,
  structuresForWaterType,
} from '@/components/StructurePicker';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { MapPicker } from '@/components/MapPicker';
import { Section } from '@/components/Section';
import { BrandHeader } from '@/components/BrandHeader';
import { Ionicons } from '@expo/vector-icons';
import { APP_VERSION } from '@/version';
import { colors, fonts, radius, spacing } from '@/theme';

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
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [savingFav, setSavingFav] = useState(false);
  const [favLabel, setFavLabel] = useState('');

  const [waterType, setWaterType] = useState<WaterType>('freshwater');
  const [species, setSpecies] = useState<Species[]>([]);
  const [structures, setStructures] = useState<StructureType[]>([]);
  const [pressureLevel, setPressureLevel] = useState<PressureLevel>('none');
  const [clarity, setClarity] = useState<WaterClarity>('stained');
  const [depth, setDepth] = useState<WaterDepth>('any');

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<Conditions[] | null>(null);
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [areaFish, setAreaFish] = useState<AreaFish[]>([]);
  const [region, setRegion] = useState<Region | null>(null);

  const conditions = forecast?.[selectedDay] ?? null;
  const strategy = strategies?.[selectedDay] ?? null;
  const regsUrl =
    region?.countryCode?.toLowerCase() === 'us'
      ? regulationsForState(region.state)?.url ?? null
      : null;

  // Keep cover and species valid for the chosen water type when it changes.
  const onChangeWaterType = useCallback((next: WaterType) => {
    setWaterType(next);
    const allowed = structuresForWaterType(next);
    // Keep whatever is still valid; an empty result is fine ("None selected").
    setStructures((prev) => prev.filter((s) => allowed.includes(s)));
    setSpecies((prev) =>
      prev.filter((sp) => speciesForWaterType(next).some((s) => s.id === sp)),
    );
  }, []);

  const toggleSpecies = useCallback((sp: Species) => {
    setSpecies((prev) =>
      prev.includes(sp) ? prev.filter((s) => s !== sp) : [...prev, sp],
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

  useEffect(() => {
    void loadFavorites().then(setFavorites);
  }, []);

  const onSaveFavorite = useCallback(async () => {
    if (!coordinates) return;
    const next = await addFavorite(favLabel || place || 'Saved spot', coordinates);
    setFavorites(next);
    setSavingFav(false);
    setFavLabel('');
  }, [coordinates, favLabel, place]);

  const onLoadFavorite = useCallback((fav: FavoriteLocation) => {
    setCoordinates({ latitude: fav.latitude, longitude: fav.longitude });
    setPlace(fav.label);
    setError(null);
  }, []);

  const onDeleteFavorite = useCallback(async (id: string) => {
    setFavorites(await deleteFavorite(id));
  }, []);

  const onPickTarget = useCallback(
    (sp: Species) => {
      const info = SPECIES.find((s) => s.id === sp);
      if (info) onChangeWaterType(info.waterType);
      setSpecies((prev) => (prev.includes(sp) ? prev : [...prev, sp]));
    },
    [onChangeWaterType],
  );

  const onAnalyze = useCallback(async () => {
    if (!coordinates) return;
    setAnalyzing(true);
    setError(null);
    try {
      const [week, fish, reg] = await Promise.all([
        gatherForecast({
          coordinates,
          waterType,
          species,
          structures,
          pressureLevel,
          clarity,
          depth,
        }),
        fetchAreaFish(coordinates).catch(() => [] as AreaFish[]),
        reverseRegion(coordinates).catch(() => null),
      ]);
      const strats = week.map((c) => buildStrategy(c));
      setForecast(week);
      setStrategies(strats);
      setSelectedDay((prev) => (prev < week.length ? prev : 0));
      setAreaFish(fish);
      setRegion(reg);
      // Catch log always attaches *today's* conditions, not a future forecast.
      if (week[0] && strats[0]) {
        onSnapshot?.(buildCatchConditions(week[0], strats[0].biteScore, place));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setAnalyzing(false);
    }
  }, [coordinates, waterType, species, structures, pressureLevel, clarity, depth, place, onSnapshot]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <BrandHeader
        heading="bayLURE"
        subtitle="Read the water. Tie on the right thing."
        version={APP_VERSION}
        display
      />

      <View style={styles.body}>
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
            <View style={styles.btnRow}>
              <Ionicons name="location-outline" size={18} color={colors.text} />
              <Text style={styles.secondaryBtnText}>Use my location</Text>
            </View>
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

        {coordinates && !savingFav ? (
          <Pressable
            style={styles.saveFavBtn}
            onPress={() => {
              setFavLabel(place);
              setSavingFav(true);
            }}
          >
            <Ionicons name="star-outline" size={15} color={colors.accent} />
            <Text style={styles.saveFavText}>Save this spot</Text>
          </Pressable>
        ) : null}

        {coordinates && savingFav ? (
          <View style={styles.favSaveRow}>
            <TextInput
              value={favLabel}
              onChangeText={setFavLabel}
              placeholder="Label (e.g. North dock, Home lake)"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.input}
            />
            <Pressable style={styles.findBtn} onPress={onSaveFavorite}>
              <Text style={styles.findBtnText}>Save</Text>
            </Pressable>
          </View>
        ) : null}

        {favorites.length > 0 ? (
          <View style={styles.favList}>
            <Text style={styles.favHeader}>Saved spots</Text>
            {favorites.map((fav) => (
              <View key={fav.id} style={styles.favRow}>
                <Pressable
                  style={styles.favTap}
                  onPress={() => onLoadFavorite(fav)}
                >
                  <Ionicons name="star" size={14} color={colors.warn} style={styles.favStar} />
                  <Text style={styles.favName}>{fav.label}</Text>
                </Pressable>
                <Pressable onPress={() => onDeleteFavorite(fav.id)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
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
          Pick one or more fish to sharpen the picks, or leave it on Any.
        </Text>
        <SpeciesPicker
          waterType={waterType}
          value={species}
          onToggle={toggleSpecies}
          onClear={() => setSpecies([])}
        />
      </Section>

      {/* Step 5 — Structure & cover (filtered to the water type) */}
      <Section title="5 · Structure & Cover">
        <Text style={styles.helper}>
          Tap everything you can see at your spot, or leave it on “None
          selected.”
        </Text>
        <StructurePicker
          waterType={waterType}
          selected={structures}
          onToggle={toggleStructure}
          onClear={() => setStructures([])}
        />
      </Section>

      {/* Step 6 — Water depth */}
      <Section title="6 · Water Depth">
        <Text style={styles.helper}>
          Roughly how deep are you fishing? It biases the lures and where the
          fish are holding.
        </Text>
        <View style={styles.toggleRow}>
          {([
            { value: 'any', label: 'Any' },
            { value: 'shallow', label: 'Shallow' },
            { value: 'mid', label: 'Mid' },
            { value: 'deep', label: 'Deep' },
          ] as const).map((opt) => {
            const active = depth === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setDepth(opt.value)}
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

      {/* Step 7 — Fishing pressure */}
      <Section title="7 · Fishing Pressure">
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

      {strategy ? <BiteForecastCard strategy={strategy} /> : null}

      {strategies ? (
        <OutlookCard
          days={strategies.map((s, i) => ({
            label: dayLabel(addDays(new Date(), i), i),
            num: dayNumber(addDays(new Date(), i)),
            score: s.biteScore,
          }))}
          selected={selectedDay}
          onSelect={setSelectedDay}
          hourly={strategy?.hourly ?? []}
          bestWindows={strategy?.bestWindows ?? []}
        />
      ) : null}

      {conditions ? (
        <Text style={styles.dayHeader}>
          {longDayLabel(addDays(new Date(), selectedDay), selectedDay)}
        </Text>
      ) : null}
      {conditions ? <ConditionsCard conditions={conditions} /> : null}
      {strategy ? <PicksCard strategy={strategy} /> : null}
      {strategy ? <InsightsCard strategy={strategy} /> : null}
      {strategy ? (
        <RegulationsCard region={region} />
      ) : null}
      {areaFish.length > 0 ? (
        <AreaFishCard
          fish={areaFish}
          onPickTarget={onPickTarget}
          regsUrl={regsUrl}
        />
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
      </View>
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
    paddingBottom: spacing.xl * 2,
  },
  body: {
    paddingHorizontal: spacing.lg,
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
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveFavBtn: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveFavText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  favSaveRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  favList: {
    marginTop: spacing.md,
  },
  favHeader: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  favTap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  favStar: {
    marginRight: spacing.sm,
  },
  favName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  favDelete: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
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
  dayHeader: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 19,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
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
