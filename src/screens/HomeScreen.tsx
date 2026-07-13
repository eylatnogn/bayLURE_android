import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  reorderFavorites,
} from '@/storage/favorites';
import { loadLastSpot, saveLastSpot } from '@/storage/lastSpot';
import { loadSettings, saveSettings } from '@/storage/settings';
import {
  loadPresets,
  addPreset,
  deletePreset,
  reorderPresets,
  type ConditionPreset,
} from '@/storage/presets';
import { getCurrentLocation, reverseGeocode } from '@/api/location';
import { geocodeQuery, reverseRegion, type Region } from '@/api/geocode';
import { gatherForecast } from '@/api/conditions';
import { isLikelySaltwater } from '@/api/tides';
import { fetchAreaFish, type AreaFish } from '@/api/areaSpecies';
import { buildStrategy } from '@/engine/strategy';
import { speciesForWaterType, SPECIES } from '@/engine/species';
import { onBackupImported } from '@/utils/backup';
import { buildCatchConditions } from '@/utils/snapshot';
import { addDays, dayLabel, dayNumber, hourLabel } from '@/utils/dates';
import { ForecastCard } from '@/components/ForecastCard';
import { TideGraphModal } from '@/components/TideGraphModal';
import { AreaFishCard } from '@/components/AreaFishCard';
import { RegulationsCard } from '@/components/RegulationsCard';
import { PicksCard } from '@/components/PicksCard';
import { InsightsCard } from '@/components/InsightsCard';
import { WaterTypeToggle } from '@/components/WaterTypeToggle';
import {
  StructurePicker,
  structuresForWaterType,
} from '@/components/StructurePicker';
import { SpeciesPicker } from '@/components/SpeciesPicker';
import { MapPicker } from '@/components/MapPicker';
import { ReorderableList } from '@/components/ReorderableList';
import { Section } from '@/components/Section';
import { BrandHeader } from '@/components/BrandHeader';
import { Button } from '@/components/Button';
import { APP_VERSION } from '@/version';
import { FREE_LIMITS, usePro } from '@/purchases/pro';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

interface Props {
  /** Called after an analysis so the catch log can attach these conditions. */
  onSnapshot?: (snapshot: CatchConditions) => void;
  /** Called with the 7-day forecast so the catch log can match upcoming days. */
  onForecast?: (forecast: Conditions[]) => void;
}

export function HomeScreen({ onSnapshot, onForecast }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { isPro, limitsActive, showPaywall } = usePro();
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
  // Index into the selected day's hourlyWeather, or null for the day overview.
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [areaFish, setAreaFish] = useState<AreaFish[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  // Presets are tucked away (collapsed); the refinements stay open by default.
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [fineTuneOpen, setFineTuneOpen] = useState(true);
  const [savedSpotsOpen, setSavedSpotsOpen] = useState(false);
  // Two-step delete: first tap arms this id, a second tap on the confirm
  // control removes it — so a stray tap never deletes a spot or preset.
  const [confirmDeleteFav, setConfirmDeleteFav] = useState<string | null>(null);
  const [confirmDeletePreset, setConfirmDeletePreset] = useState<string | null>(null);
  // The "Tides & Bite" hourly graph modal (saltwater spots only).
  const [tideGraphOpen, setTideGraphOpen] = useState(false);
  // The angler's own saved condition configurations.
  const [customPresets, setCustomPresets] = useState<ConditionPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetLabel, setPresetLabel] = useState('');
  // True once the angler has chosen a water type by hand/preset — auto-detect
  // then leaves it alone.
  const userSetWaterType = useRef(false);

  // Scroll plumbing for the floating jump button (top <-> bite forecast).
  const scrollRef = useRef<ScrollView>(null);
  // While a saved-spot/preset row is being dragged, freeze the page so the
  // reorder gesture can't scroll the screen out from under the finger.
  const [reordering, setReordering] = useState(false);
  const bodyY = useRef(0); // body offset within the scroll content
  // The map's wrapper, measured when the tide sheet opens so the map — not
  // the page top — lands in the strip above the sheet.
  const mapWrapRef = useRef<View>(null);
  // The forecast card's wrapper, for the jump button's fresh measurements.
  const forecastWrapRef = useRef<View>(null);
  // The "Pick a day" anchor inside the card — the jump button lands here, on
  // the day picker + conditions, not on the score header above them.
  const pickDayRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  // Collapse "Fine-tune your read" once, when the first results land.
  const hadResults = useRef(false);
  const forecastRelY = useRef(0); // forecast card offset within the body
  const [nearForecast, setNearForecast] = useState(false);

  // Auto-analyze plumbing: the signature of the last setup we analyzed, and a
  // live ref to onAnalyze so the debounced effect always calls the latest one.
  const lastSigRef = useRef('');
  const onAnalyzeRef = useRef<(silent?: boolean) => void>(() => {});

  const conditions = forecast?.[selectedDay] ?? null;
  const strategy = strategies?.[selectedDay] ?? null;
  const regsUrl =
    region?.countryCode?.toLowerCase() === 'us'
      ? regulationsForState(region.state)?.url ?? null
      : null;

  // Wind for the map overlay: the analyzed forecast for the chosen day + hour
  // ("today / overview" uses today's now-snapshot). Null before the first
  // analysis — the map itself makes no weather requests.
  let windTargetLabel = 'Now';
  let windWx = conditions ? conditions.weather : null;
  if (conditions && !(selectedDay === 0 && selectedHour === null)) {
    const wx = selectedHour != null ? conditions.hourlyWeather[selectedHour] : null;
    windWx = wx ?? conditions.weather;
    windTargetLabel = `${dayLabel(addDays(new Date(), selectedDay), selectedDay)} ${hourLabel(windWx.timeISO)}`;
  }

  // One-line recap of the current setup, shown by the Analyze button so the
  // angler can see what will be analyzed without opening the fine-tune panel.
  const configSummary = [
    waterType === 'saltwater' ? 'Saltwater' : 'Freshwater',
    species.length ? `${species.length} target${species.length > 1 ? 's' : ''}` : 'Any species',
    `${cap(clarity)} water`,
    depth === 'any' ? 'Any depth' : `${cap(depth)} depth`,
    `${PRESSURE_WORD[pressureLevel]} pressure`,
  ].join('  ·  ');

  // Set the water type and drop any cover/species that don't fit it. Shared by
  // the manual toggle, presets, and the location auto-detect.
  const setWaterTypeFiltered = useCallback((next: WaterType) => {
    setWaterType(next);
    const allowed = structuresForWaterType(next);
    // Keep whatever is still valid; an empty result is fine ("None selected").
    setStructures((prev) => prev.filter((s) => allowed.includes(s)));
    setSpecies((prev) =>
      prev.filter((sp) => speciesForWaterType(next).some((s) => s.id === sp)),
    );
  }, []);

  // Manual toggle: remember that the angler chose, so auto-detect won't override.
  const onChangeWaterType = useCallback(
    (next: WaterType) => {
      userSetWaterType.current = true;
      setWaterTypeFiltered(next);
    },
    [setWaterTypeFiltered],
  );

  const applyPreset = useCallback((p: Preset) => {
    userSetWaterType.current = true;
    setWaterType(p.waterType);
    setSpecies(p.species);
    setStructures(p.structures);
  }, []);

  // Custom presets carry the full config (clarity/depth/pressure too).
  const applyCustomPreset = useCallback((p: ConditionPreset) => {
    userSetWaterType.current = true;
    setWaterType(p.waterType);
    setSpecies(p.species);
    setStructures(p.structures);
    setClarity(p.clarity);
    setDepth(p.depth);
    setPressureLevel(p.pressureLevel);
  }, []);

  const onSavePreset = useCallback(async () => {
    // Free tier: one preset. Existing presets always stay usable.
    if (!isPro && limitsActive && customPresets.length >= FREE_LIMITS.presets) {
      showPaywall();
      return;
    }
    const next = await addPreset(presetLabel, {
      waterType,
      species,
      structures,
      clarity,
      depth,
      pressureLevel,
    });
    setCustomPresets(next);
    setSavingPreset(false);
    setPresetLabel('');
  }, [presetLabel, waterType, species, structures, clarity, depth, pressureLevel, isPro, limitsActive, customPresets.length, showPaywall]);

  const onDeletePreset = useCallback(async (id: string) => {
    setCustomPresets(await deletePreset(id));
  }, []);

  // Drag reorder: update the list immediately, persist the new order after.
  const onReorderPresets = useCallback((list: ConditionPreset[]) => {
    setCustomPresets(list);
    void reorderPresets(list);
  }, []);
  const onReorderFavorites = useCallback((list: FavoriteLocation[]) => {
    setFavorites(list);
    void reorderFavorites(list);
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

  // Reopen on the last spot the angler viewed — the auto-analyze effect then
  // rebuilds the forecast for it. Skipped if they set a location even faster.
  useEffect(() => {
    void loadLastSpot().then((last) => {
      if (!last) return;
      setCoordinates((prev) => prev ?? last.coordinates);
      setPlace((prev) => prev || last.place);
    });
  }, []);

  // Remember the current spot (and its label as it refines) for next launch.
  useEffect(() => {
    if (!coordinates) return;
    void saveLastSpot(coordinates, place);
  }, [coordinates, place]);

  // Pre-fill the form with the angler's last-used settings.
  useEffect(() => {
    void loadSettings().then((s) => {
      if (!s) return;
      setWaterType(s.waterType);
      setSpecies(s.species);
      setStructures(s.structures);
      setClarity(s.clarity);
      setDepth(s.depth);
      setPressureLevel(s.pressureLevel);
    });
  }, []);

  useEffect(() => {
    void loadPresets().then(setCustomPresets);
  }, []);

  // A backup import (Guide tab) can add spots/presets while this screen stays
  // mounted — reload both lists when that happens.
  useEffect(
    () =>
      onBackupImported(() => {
        void loadFavorites().then(setFavorites);
        void loadPresets().then(setCustomPresets);
      }),
    [],
  );

  // Auto-pick water type from the spot (coastal → saltwater) unless the angler
  // has already set it by hand or via a preset.
  useEffect(() => {
    if (!coordinates || userSetWaterType.current) return;
    void isLikelySaltwater(coordinates).then((salt) => {
      if (userSetWaterType.current) return;
      setWaterTypeFiltered(salt ? 'saltwater' : 'freshwater');
    });
  }, [coordinates, setWaterTypeFiltered]);

  const onSaveFavorite = useCallback(async () => {
    if (!coordinates) return;
    // Free tier: one saved spot. Existing spots always stay usable.
    if (!isPro && limitsActive && favorites.length >= FREE_LIMITS.spots) {
      showPaywall();
      return;
    }
    // `place` can be a raw "lat, long" string when the spot came from a pin
    // drop or GPS; never use that as a label.
    const placeLabel = /^-?\d+\.\d+, -?\d+\.\d+$/.test(place) ? '' : place;
    const next = await addFavorite(favLabel.trim() || placeLabel || 'Saved spot', coordinates);
    setFavorites(next);
    setSavingFav(false);
    setFavLabel('');
  }, [coordinates, favLabel, place, isPro, limitsActive, favorites.length, showPaywall]);

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

  const onAnalyze = useCallback(async (silent = false) => {
    if (!coordinates) return;
    // Mark this exact setup as analyzed so the auto-analyze effect doesn't
    // immediately fire again for the same inputs.
    lastSigRef.current = analyzeSig(
      coordinates, waterType, species, structures, clarity, depth, pressureLevel,
    );
    // Remember this setup so the next session starts pre-filled.
    void saveSettings({ waterType, species, structures, clarity, depth, pressureLevel });
    setAnalyzing(true);
    if (!silent) setError(null);
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
      onForecast?.(week);
      setStrategies(strats);
      setSelectedDay((prev) => (prev < week.length ? prev : 0));
      setSelectedHour(null);
      setAreaFish(fish);
      setRegion(reg);
      setError(null); // a successful run clears any earlier failure
      // First results: tuck the fine-tune form away so the forecast is the
      // star. Only once — re-runs while the angler tweaks it shouldn't fight.
      if (!hadResults.current) {
        hadResults.current = true;
        setFineTuneOpen(false);
      }
      // Catch log always attaches *today's* conditions, not a future forecast.
      if (week[0] && strats[0]) {
        onSnapshot?.(buildCatchConditions(week[0], strats[0].biteScore, place));
      }
    } catch (e) {
      // An automatic run shouldn't nag with a banner the angler didn't trigger
      // (usually a transient rate limit). Surface errors only for a manual tap;
      // the Analyze button stays available to retry and see what's wrong.
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      setAnalyzing(false);
    }
  }, [coordinates, waterType, species, structures, pressureLevel, clarity, depth, place, onSnapshot, onForecast]);

  // Keep a live ref to the latest onAnalyze for the debounced auto-run.
  onAnalyzeRef.current = onAnalyze;

  // Auto-run the analysis once a location is set (the only required field —
  // everything else has a sensible default), and again whenever the setup
  // changes. Debounced so rapid edits settle into one run; thanks to the
  // per-location cache, refinement-only re-runs don't re-hit the weather API.
  useEffect(() => {
    if (!coordinates || analyzing) return; // hold off until any run finishes
    const sig = analyzeSig(
      coordinates, waterType, species, structures, clarity, depth, pressureLevel,
    );
    if (sig === lastSigRef.current) return; // already analyzed this exact setup
    const timer = setTimeout(() => {
      if (sig === lastSigRef.current) return; // a manual Analyze beat us to it
      void onAnalyzeRef.current(true); // silent: don't show a banner on auto-runs
    }, 800);
    return () => clearTimeout(timer);
  }, [coordinates, waterType, species, structures, clarity, depth, pressureLevel, analyzing]);

  // Floating jump button: hop between the map and the bite forecast.
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollYRef.current = y;
    const near = y >= bodyY.current + forecastRelY.current - 120;
    setNearForecast((prev) => (prev === near ? prev : near));
  }, []);

  // Fresh y-offset of a wrapper inside the scroll content. Collapsing sections
  // shifts everything, so stored offsets go stale — measure at press time.
  const measureInScroll = useCallback((ref: React.RefObject<View | null>) => {
    return new Promise<number | null>((resolve) => {
      const scroller = scrollRef.current;
      const inner = (scroller as unknown as { getInnerViewNode?: () => unknown })
        ?.getInnerViewNode?.();
      const node = ref.current as unknown as {
        measureLayout?: (n: unknown, ok: (x: number, y: number) => void, fail: () => void) => void;
      } | null;
      if (!inner || !node?.measureLayout) {
        resolve(null);
        return;
      }
      node.measureLayout(inner, (_x, y) => resolve(y), () => resolve(null));
    });
  }, []);

  const jumpToForecast = useCallback(async () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const [mapY, forecastY, pickDayY] = await Promise.all([
      measureInScroll(mapWrapRef),
      measureInScroll(forecastWrapRef),
      measureInScroll(pickDayRef),
    ]);
    // Land on "Pick a day" (day picker + conditions), not the score header.
    const targetY = pickDayY ?? forecastY;
    if (mapY == null || targetY == null) {
      // Fallback to the stored offsets if measuring isn't available.
      scroller.scrollTo({
        y: nearForecast ? 0 : Math.max(0, bodyY.current + forecastRelY.current - 8),
        animated: true,
      });
      return;
    }
    // At (or past) the target → hop up to the map; otherwise → down to it.
    const atForecast = scrollYRef.current >= targetY - 160;
    scroller.scrollTo({
      y: Math.max(0, (atForecast ? mapY : targetY) - 8),
      animated: true,
    });
  }, [nearForecast, measureInScroll]);

  return (
    <View style={styles.root}>
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={16}
      scrollEnabled={!reordering}
    >
      <BrandHeader
        heading="bayLURE"
        subtitle="Read the water. Tie on the right thing."
        version={APP_VERSION}
        display
        showThemeToggle
      />

      <View
        style={styles.body}
        onLayout={(e) => {
          bodyY.current = e.nativeEvent.layout.y;
        }}
      >
      {/* Step 1 — Location */}
      <Section title="Location" icon="map-pin">
        <Pressable
          onPress={useMyLocation}
          disabled={locating}
          style={({ pressed }) => [
            styles.secondaryBtn,
            locating && styles.btnDisabled,
            pressed && pressedStyle,
          ]}
        >
          {locating ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <View style={styles.btnRow}>
              <Feather name="map-pin" size={16} color={colors.text} />
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
            style={({ pressed }) => [
              styles.findBtn,
              (geocoding || !query.trim()) && styles.btnDisabled,
              pressed && pressedStyle,
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
        {/* collapsable=false so the wrapper stays measurable on Android. */}
        <View ref={mapWrapRef} collapsable={false} style={styles.mapWrap}>
          <MapPicker
            center={coordinates}
            onPick={onPickOnMap}
            windTargetLabel={windTargetLabel}
            windMph={windWx?.windMph ?? null}
            windDirDeg={windWx?.windDirectionDeg ?? null}
          />
        </View>

        <Text style={styles.selected}>
          {coordinates
            ? `Spot set — ${place}`
            : 'No spot selected yet.'}
        </Text>

        {coordinates && !savingFav ? (
          <Pressable
            style={({ pressed }) => [styles.saveFavBtn, pressed && pressedStyle]}
            onPress={() => {
              setFavLabel('');
              setSavingFav(true);
            }}
          >
            <View style={styles.btnRow}>
              <Feather name="star" size={14} color={colors.accent} />
              <Text style={styles.saveFavText}>Save this spot</Text>
            </View>
          </Pressable>
        ) : null}

        {coordinates && savingFav ? (
          <View style={styles.favSaveRow}>
            <TextInput
              value={favLabel}
              onChangeText={setFavLabel}
              placeholder="Spot Name"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.input}
            />
            <Pressable
              style={({ pressed }) => [styles.findBtn, pressed && pressedStyle]}
              onPress={onSaveFavorite}
            >
              <Text style={styles.findBtnText}>Save</Text>
            </Pressable>
          </View>
        ) : null}

        {favorites.length > 0 ? (
          <View style={styles.favList}>
            <Pressable
              onPress={() => setSavedSpotsOpen((v) => !v)}
              style={({ pressed }) => [styles.favDropdown, pressed && pressedStyle]}
            >
              <Text style={styles.favDropdownLabel}>
                Saved spots ({favorites.length})
              </Text>
              <Feather
                name={savedSpotsOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
            {savedSpotsOpen ? (
              <>
                <Text style={styles.dragHint}>
                  Tap to load · press and hold 1.5s to reorder
                </Text>
                <ReorderableList
                  items={favorites}
                  keyOf={(f) => f.id}
                  rowHeight={44}
                  onReorder={onReorderFavorites}
                  onActiveChange={setReordering}
                  rowStyle={styles.favRowCard}
                  onItemPress={(fav) => onLoadFavorite(fav)}
                  renderItem={(fav) => (
                    <>
                      <Feather name="star" size={14} color={colors.warn} />
                      <Text style={styles.favName} numberOfLines={1}>
                        {fav.label}
                      </Text>
                    </>
                  )}
                  renderTrailing={(fav) =>
                    confirmDeleteFav === fav.id ? (
                      <View style={styles.confirmDeleteRow}>
                        <Pressable
                          onPress={() => {
                            void onDeleteFavorite(fav.id);
                            setConfirmDeleteFav(null);
                          }}
                          hitSlop={8}
                        >
                          <Text style={styles.confirmDeleteText}>Delete</Text>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDeleteFav(null)} hitSlop={8}>
                          <Text style={styles.confirmCancelText}>Cancel</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => setConfirmDeleteFav(fav.id)} hitSlop={8}>
                        <Feather name="trash-2" size={15} color={colors.textMuted} />
                      </Pressable>
                    )
                  }
                />
              </>
            ) : null}
          </View>
        ) : null}
      </Section>

      {/* Presets — collapsed by default, optional */}
      <Pressable
        onPress={() => setQuickStartOpen((v) => !v)}
        style={({ pressed }) => [styles.collapse, pressed && pressedStyle]}
      >
        <Text style={styles.collapseTitle}>Presets</Text>
        <Feather
          name={quickStartOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {quickStartOpen ? (
        <Section title="Quick Start" icon="zap">
          <Text style={styles.helper}>
            Tap a starter profile, or save your own setup below to reuse it.
          </Text>
          {/* Starter profiles and saved setups share one chip group so the
              section reads as a single container. */}
          <View style={styles.presetWrap}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => applyPreset(p)}
                style={({ pressed }) => [styles.preset, pressed && pressedStyle]}
              >
                <Text style={styles.presetText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* The angler's own presets — a drag-to-reorder list (grip on the
              right) so the order they see is the order they set. */}
          {customPresets.length > 0 ? (
            <View style={styles.presetList}>
              <Text style={styles.dragHint}>
                Tap to apply · press and hold 1.5s to reorder
              </Text>
              <ReorderableList
                items={customPresets}
                keyOf={(p) => p.id}
                rowHeight={42}
                onReorder={onReorderPresets}
                onActiveChange={setReordering}
                rowStyle={styles.presetRowCard}
                onItemPress={(p) => applyCustomPreset(p)}
                renderItem={(p) => (
                  <>
                    <Feather name="bookmark" size={13} color={colors.accent} />
                    <Text style={styles.presetText} numberOfLines={1}>
                      {p.label}
                    </Text>
                  </>
                )}
                renderTrailing={(p) =>
                  confirmDeletePreset === p.id ? (
                    <View style={styles.confirmDeleteRow}>
                      <Pressable
                        onPress={() => {
                          void onDeletePreset(p.id);
                          setConfirmDeletePreset(null);
                        }}
                        hitSlop={8}
                      >
                        <Text style={styles.confirmDeleteText}>Delete</Text>
                      </Pressable>
                      <Pressable onPress={() => setConfirmDeletePreset(null)} hitSlop={8}>
                        <Text style={styles.confirmCancelText}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => setConfirmDeletePreset(p.id)} hitSlop={8}>
                      <Feather name="trash-2" size={14} color={colors.textMuted} />
                    </Pressable>
                  )
                }
              />
            </View>
          ) : null}

          {!savingPreset ? (
            <Pressable
              style={styles.saveFavBtn}
              onPress={() => {
                setPresetLabel('');
                setSavingPreset(true);
              }}
            >
              <Feather name="plus" size={15} color={colors.accent} />
              <Text style={styles.saveFavText}>Save current setup as a preset</Text>
            </Pressable>
          ) : (
            <View style={styles.favSaveRow}>
              <TextInput
                value={presetLabel}
                onChangeText={setPresetLabel}
                placeholder="Preset Name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                style={styles.input}
              />
              <Pressable style={styles.findBtn} onPress={onSavePreset}>
                <Text style={styles.findBtnText}>Save</Text>
              </Pressable>
            </View>
          )}
        </Section>
      ) : null}

      {/* Refinements, collapsed by default so the fast path stays short */}
      <Pressable
        onPress={() => setFineTuneOpen((v) => !v)}
        style={({ pressed }) => [styles.collapse, pressed && pressedStyle]}
      >
        <Text style={styles.collapseTitle}>Fine-tune your read</Text>
        <Feather
          name={fineTuneOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMuted}
        />
      </Pressable>

      {fineTuneOpen ? (
        <View>
          <Section title="Water Type" icon="droplet">
            <WaterTypeToggle value={waterType} onChange={onChangeWaterType} />
            <Text style={[styles.helper, styles.helperGap]}>
              Auto-set from your spot when possible — tap to override.
            </Text>
          </Section>

          <Section title="Water & Spot" icon="map">
            <Text style={styles.helper}>Water clarity — how far you can see in.</Text>
            <OptionRow
              value={clarity}
              onChange={setClarity}
              options={[
                { value: 'clear', label: 'Clear' },
                { value: 'stained', label: 'Stained' },
                { value: 'muddy', label: 'Muddy' },
              ]}
            />
            <Text style={[styles.helper, styles.helperGap]}>Depth you're fishing.</Text>
            <OptionRow
              value={depth}
              onChange={setDepth}
              options={[
                { value: 'any', label: 'Any' },
                { value: 'shallow', label: 'Shallow' },
                { value: 'mid', label: 'Mid' },
                { value: 'deep', label: 'Deep' },
              ]}
            />
            <Text style={[styles.helper, styles.helperGap]}>
              Fishing pressure — busier water means warier fish.
            </Text>
            <OptionRow
              value={pressureLevel}
              onChange={setPressureLevel}
              options={[
                { value: 'none', label: 'Light' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'Heavy' },
              ]}
            />
          </Section>

          <Section title="Target Species" icon="target">
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

          <Section title="Structure & Cover" icon="layers">
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
        </View>
      ) : null}

      <Text style={styles.summaryLine}>{configSummary}</Text>

      <Button
        title={coordinates ? 'Analyze my spot' : 'Set a location first'}
        icon="target"
        onPress={() => onAnalyze()}
        disabled={analyzing || !coordinates}
        loading={analyzing}
      />

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View
        ref={forecastWrapRef}
        collapsable={false}
        onLayout={(e) => {
          forecastRelY.current = e.nativeEvent.layout.y;
        }}
      >
        {strategy && conditions && strategies ? (
          <ForecastCard
            strategy={strategy}
            conditions={conditions}
            days={strategies.map((s, i) => ({
              label: dayLabel(addDays(new Date(), i), i),
              num: dayNumber(addDays(new Date(), i)),
              score: s.biteScore,
            }))}
            selectedDay={selectedDay}
            onSelectDay={(day) => {
              setSelectedDay(day);
              setSelectedHour(null);
            }}
            selectedHour={selectedHour}
            onSelectHour={setSelectedHour}
            pickDayRef={pickDayRef}
            onShowTideGraph={() => {
              // Scroll the MAP (not the page top) into the strip above the
              // sheet, so the spot and the graph are visible together.
              const scroller = scrollRef.current;
              const inner = (scroller as unknown as { getInnerViewNode?: () => unknown })
                ?.getInnerViewNode?.();
              const mapNode = mapWrapRef.current as unknown as {
                measureLayout?: (
                  node: unknown,
                  ok: (x: number, y: number) => void,
                  fail: () => void,
                ) => void;
              } | null;
              if (scroller && inner && mapNode?.measureLayout) {
                mapNode.measureLayout(
                  inner,
                  (_x, y) => scroller.scrollTo({ y: Math.max(0, y - 6), animated: true }),
                  () => scroller.scrollTo({ y: 0, animated: true }),
                );
              } else {
                scroller?.scrollTo({ y: 0, animated: true });
              }
              setTideGraphOpen(true);
            }}
          />
        ) : null}
      </View>
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

      {/* Quick hop between the form and the bite forecast, once results exist. */}
      {conditions ? (
        <Pressable
          onPress={jumpToForecast}
          hitSlop={8}
          style={({ pressed }) => [styles.jumpBtn, pressed && pressedStyle]}
          accessibilityLabel={nearForecast ? 'Jump to the map' : 'Jump to bite forecast'}
        >
          <Feather
            name={nearForecast ? 'chevron-up' : 'chevron-down'}
            size={26}
            color={colors.onAccent}
          />
        </Pressable>
      ) : null}

      {/* Floating bottom sheet — NOT a Modal, so the map above stays live. */}
      {strategies && forecast ? (
        <TideGraphModal
          visible={tideGraphOpen}
          onClose={() => setTideGraphOpen(false)}
          forecast={forecast}
          strategies={strategies}
          days={strategies.map((s, i) => ({
            label: dayLabel(addDays(new Date(), i), i),
            num: dayNumber(addDays(new Date(), i)),
            score: s.biteScore,
          }))}
          selectedDay={selectedDay}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setSelectedHour(null);
          }}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
        />
      ) : null}
    </View>
  );
}

function formatCoords(c: Coordinates): string {
  return `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;
}

// Stable fingerprint of the inputs that change the analysis result, used to
// skip auto-analyzing a setup we've already run. Empty string = not analyzable.
function analyzeSig(
  coordinates: Coordinates | null,
  waterType: WaterType,
  species: Species[],
  structures: StructureType[],
  clarity: WaterClarity,
  depth: WaterDepth,
  pressureLevel: PressureLevel,
): string {
  if (!coordinates) return '';
  return JSON.stringify([
    coordinates.latitude.toFixed(3),
    coordinates.longitude.toFixed(3),
    waterType,
    [...species].sort(),
    [...structures].sort(),
    clarity,
    depth,
    pressureLevel,
  ]);
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

const PRESSURE_WORD: Record<PressureLevel, string> = {
  none: 'Light',
  moderate: 'Moderate',
  high: 'Heavy',
};

interface Preset {
  label: string;
  waterType: WaterType;
  species: Species[];
  structures: StructureType[];
}

/** One-tap profiles that set water type + likely species + typical cover. */
const PRESETS: Preset[] = [
  { label: 'Lake bass', waterType: 'freshwater', species: ['largemouth'], structures: ['vegetation', 'wood'] },
  { label: 'River smallmouth', waterType: 'freshwater', species: ['smallmouth'], structures: ['rock', 'current'] },
  { label: 'Trout stream', waterType: 'freshwater', species: ['trout'], structures: ['rock', 'current'] },
  { label: 'Panfish', waterType: 'freshwater', species: ['panfish'], structures: ['wood', 'vegetation'] },
  { label: 'Catfish', waterType: 'freshwater', species: ['catfish'], structures: ['current', 'dropoff'] },
  { label: 'Inshore slam', waterType: 'saltwater', species: ['redfish', 'seatrout'], structures: ['vegetation', 'oyster'] },
  { label: 'Snook & docks', waterType: 'saltwater', species: ['snook'], structures: ['mangrove', 'wood'] },
  { label: 'Surf / stripers', waterType: 'saltwater', species: ['striper'], structures: ['current', 'open'] },
];

interface PillOption<T extends string> {
  value: T;
  label: string;
}

/** A single-choice row of pills (used for clarity, depth, and pressure). */
function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.toggleRow}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [
              styles.togglePill,
              active && styles.togglePillActive,
              pressed && pressedStyle,
            ]}
          >
            <Text style={[styles.togglePillText, active && styles.togglePillTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors, { shadow }) => ({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  jumpBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
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
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  favDropdown: {
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
  favDropdownLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  // Two-step delete confirm shown in place of the trash icon.
  confirmDeleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  confirmDeleteText: {
    color: colors.errorText,
    fontSize: 13,
    fontWeight: '800',
  },
  confirmCancelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  // The map breaks out of most of the card padding for a wider preview, but
  // stops short of the card edge so a strip stays on each side to grab for
  // scrolling the page (the map itself captures vertical drags).
  mapWrap: {
    marginHorizontal: -spacing.sm,
  },
  // Card look for a reorderable saved-spot row (positioned by ReorderableList,
  // so no margin — the grip sits inside the card on the right).
  favRowCard: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingLeft: spacing.md,
  },
  // Small cue above the reorderable lists so the hold-to-reorder gesture is
  // discoverable (a plain tap otherwise just loads/applies the row).
  dragHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  favName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
  },
  helperGap: { marginTop: spacing.md },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  preset: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  presetList: { marginTop: spacing.sm },
  // Card look for a reorderable custom-preset row (grip inside, on the right).
  presetRowCard: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingLeft: spacing.md,
  },
  presetText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  collapse: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  collapseTitle: { color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  summaryLine: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
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
}));
