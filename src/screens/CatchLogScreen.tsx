import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CatchConditions, CatchRecord, Conditions } from '@/types';
import { SPECIES } from '@/engine/species';
import { LURES } from '@/engine/lureDatabase';
import { addCatch, deleteCatch, loadCatches, updateCatch } from '@/storage/catchLog';
import { onBackupImported } from '@/utils/backup';
import { summarizeCatchConditions } from '@/utils/snapshot';
import { CatchReportCard } from '@/components/CatchReportCard';
import { SearchPick } from '@/components/SearchPick';
import { Section } from '@/components/Section';
import { BrandHeader } from '@/components/BrandHeader';
import { FREE_LIMITS, usePro } from '@/purchases/pro';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

// Search options: species by name, and every lure/rig/bait with its category
// tag. Free-typed entries are always allowed via the "Use …" row.
const SPECIES_OPTIONS = SPECIES.map((s) => ({ name: s.label }));

/** Today as the MM/DD/YYYY the date field uses. */
function todayInput(): string {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** Parse MM/DD/YYYY (or M/D/YYYY) to a Date at local noon, or null if invalid. */
function parseCatchDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]), 12, 0, 0);
  // Reject rollovers like 2/31 (which Date silently turns into March).
  if (d.getMonth() !== Number(m[1]) - 1 || d.getDate() !== Number(m[2])) return null;
  return d;
}
const GEAR_OPTIONS = LURES.map((l) => ({
  name: l.name,
  tag: l.category.toUpperCase(),
}));

interface Props {
  /** Latest analyzed conditions from the planner, offered for attaching. */
  snapshot?: CatchConditions | null;
  /** Latest 7-day forecast from the planner, for upcoming-day matching. */
  forecast?: Conditions[] | null;
}

export function CatchLogScreen({ snapshot, forecast }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { isPro, limitsActive, showPaywall } = usePro();
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  // Set while editing an existing catch (vs. logging a new one).
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [species, setSpecies] = useState<string | null>(null);
  const [lure, setLure] = useState<string | null>(null);
  const [rig, setRig] = useState<string | null>(null);
  const [bait, setBait] = useState<string | null>(null);
  const [gearOther, setGearOther] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attachConditions, setAttachConditions] = useState(true);
  // When/where overrides so a catch from earlier in the week can be
  // backdated and labeled, instead of logging as "today at the analyzed spot".
  const [catchDate, setCatchDate] = useState(todayInput());
  const [placeLabel, setPlaceLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Two-step delete: first tap arms this id, the confirm row does the delete.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void loadCatches().then((list) => {
      setCatches(list);
      setLoading(false);
    });
  }, []);

  // A backup import (Guide tab) can add catches while this screen stays
  // mounted — reload the list when that happens.
  useEffect(
    () =>
      onBackupImported(() => {
        void loadCatches().then(setCatches);
      }),
    [],
  );

  const resetForm = useCallback(() => {
    setSpecies(null);
    setLure(null);
    setRig(null);
    setBait(null);
    setGearOther(null);
    setSize('');
    setNotes('');
    setPhotoUri(null);
    setEditingId(null);
    setError(null);
    setCatchDate(todayInput());
    setPlaceLabel('');
  }, []);

  const resolvedSpecies = species ?? '';
  const hasGear = !!(lure || rig || bait || gearOther);

  // A gear pick fills its category's slot; a free-typed entry goes to its own.
  const onPickGear = useCallback((name: string, custom: boolean) => {
    if (custom) {
      setGearOther(name);
      return;
    }
    const item = LURES.find((l) => l.name === name);
    if (!item) return;
    if (item.category === 'lure') setLure(name);
    else if (item.category === 'rig') setRig(name);
    else setBait(name);
  }, []);

  const pickPhoto = useCallback(async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Photo permission denied. You can still log the catch without a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.4,
        base64: Platform.OS === 'web',
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      // Resize down before storing — full-res photos blow past on-device
      // storage limits (this caused the "quota exceeded" error on web).
      const wantsBase64 = Platform.OS === 'web';
      try {
        const context = ImageManipulator.manipulate(asset.uri);
        // Height omitted on purpose: the API computes it to keep the ratio.
        // Passing an explicit null here throws a native range error on Android.
        context.resize({ width: 700 });
        const rendered = await context.renderAsync();
        const manipulated = await rendered.saveAsync({
          compress: 0.4,
          format: SaveFormat.JPEG,
          base64: wantsBase64,
        });
        // On web, persist a small data URL so the photo survives a reload; on
        // native the resized file URI in the app sandbox is fine.
        if (wantsBase64 && manipulated.base64) {
          setPhotoUri(`data:image/jpeg;base64,${manipulated.base64}`);
        } else {
          setPhotoUri(manipulated.uri);
        }
      } catch {
        // Resizing is an optimization — if it fails, keep the original photo
        // (the storage-quota retry in onSave still covers oversized ones).
        if (wantsBase64 && asset.base64) {
          setPhotoUri(`data:image/jpeg;base64,${asset.base64}`);
        } else {
          setPhotoUri(asset.uri);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the photo library.');
    }
  }, []);

  const onSave = useCallback(async () => {
    // Free tier caps *new* catches; editing an existing one is always allowed.
    if (!editingId && !isPro && limitsActive && catches.length >= FREE_LIMITS.catches) {
      showPaywall();
      return;
    }
    if (!resolvedSpecies) {
      setError('Pick a species.');
      return;
    }
    if (!hasGear) {
      setError('Add what caught it — a lure, rig, or bait.');
      return;
    }

    // New catches can be backdated (MM/DD/YYYY, today by default).
    let dateISO: string | undefined;
    let when: Date | null = null;
    if (!editingId) {
      when = parseCatchDate(catchDate);
      if (!when) {
        setError('Enter the catch date as MM/DD/YYYY.');
        return;
      }
      if (when.getTime() > Date.now()) {
        setError("The catch date can't be in the future.");
        return;
      }
      const backdated = when.toDateString() !== new Date().toDateString();
      if (backdated) dateISO = when.toISOString();
    }
    setSaving(true);
    setError(null);

    // When editing, keep the conditions and date the catch was first logged.
    const original = editingId ? catches.find((c) => c.id === editingId) : undefined;
    // Attached conditions pick up the edited place label and, when backdated,
    // move their timestamp to that day (local noon — exact hour unknown).
    let conditions = editingId
      ? original?.conditions
      : attachConditions && snapshot
        ? snapshot
        : undefined;
    if (editingId && conditions) {
      // Editing keeps the logged conditions as-is, except the location label,
      // which the angler can rename (or clear) from the edit form.
      const place = placeLabel.trim();
      conditions = { ...conditions, place: place || undefined };
    } else if (!editingId && conditions && when) {
      const place = placeLabel.trim() || conditions.place;
      const capturedAt = dateISO
        ? `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}T12:00`
        : conditions.capturedAt;
      conditions = { ...conditions, place, capturedAt };
    }
    const record = {
      species: resolvedSpecies,
      lure: lure ?? undefined,
      rig: rig ?? undefined,
      bait: bait ?? undefined,
      gearOther: gearOther ?? undefined,
      size: size.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUri: photoUri ?? undefined,
      dateISO,
      conditions,
    };

    const persistRecord = (rec: typeof record) =>
      editingId ? updateCatch(editingId, rec) : addCatch(rec);

    try {
      let next: CatchRecord[];
      try {
        next = await persistRecord(record);
      } catch (storageErr) {
        // Almost always a storage-quota error from the photo. Retry without it.
        if (record.photoUri) {
          next = await persistRecord({ ...record, photoUri: undefined });
          setNotice('Catch saved — the photo was too large for on-device storage, so it wasn\'t kept.');
        } else {
          throw storageErr;
        }
      }
      setCatches(next);
      resetForm();
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the catch.');
    } finally {
      setSaving(false);
    }
  }, [resolvedSpecies, hasGear, lure, rig, bait, gearOther, size, notes, photoUri, attachConditions, snapshot, editingId, catches, resetForm, isPro, limitsActive, showPaywall, catchDate, placeLabel]);

  const onDelete = useCallback(async (id: string) => {
    const next = await deleteCatch(id);
    setCatches(next);
  }, []);

  const onEdit = useCallback((c: CatchRecord) => {
    setNotice(null);
    setError(null);
    setSpecies(c.species || null);
    setLure(c.lure ?? null);
    setRig(c.rig ?? null);
    setBait(c.bait ?? null);
    setGearOther(c.gearOther ?? null);
    setSize(c.size ?? '');
    setNotes(c.notes ?? '');
    setPhotoUri(c.photoUri ?? null);
    setPlaceLabel(c.conditions?.place ?? '');
    setEditingId(c.id);
    setFormOpen(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <BrandHeader
        heading="Catch Log"
        subtitle="Log what you catch and what caught it — stays on your device."
        display
      />

      <View style={styles.body}>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {!formOpen ? (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && pressedStyle]}
          onPress={() => {
            setNotice(null);
            setEditingId(null);
            setCatchDate(todayInput());
            setPlaceLabel(snapshot?.place ?? '');
            setFormOpen(true);
          }}
        >
          <View style={styles.ctaRow}>
            <Feather name="plus" size={18} color={colors.onAccent} />
            <Text style={styles.ctaText}>Log a catch</Text>
          </View>
        </Pressable>
      ) : (
        <Section
          title={editingId ? 'Edit Catch' : 'New Catch'}
          right={
            <Pressable
              onPress={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          }
        >
          <Text style={styles.fieldLabel}>Species</Text>
          {species ? (
            <View style={styles.chipWrap}>
              <SelectedChip label={species} onRemove={() => setSpecies(null)} />
            </View>
          ) : (
            <SearchPick
              placeholder="Search species, or type your own…"
              options={SPECIES_OPTIONS}
              onPick={(name) => setSpecies(name)}
            />
          )}

          <Text style={styles.fieldLabel}>What caught it?</Text>
          <Text style={styles.subLabel}>
            Search lures, rigs, and bait — or type anything and tap “Use”.
          </Text>
          {lure || rig || bait || gearOther ? (
            <View style={styles.chipWrap}>
              {lure ? <SelectedChip label={lure} tag="LURE" onRemove={() => setLure(null)} /> : null}
              {rig ? <SelectedChip label={rig} tag="RIG" onRemove={() => setRig(null)} /> : null}
              {bait ? <SelectedChip label={bait} tag="BAIT" onRemove={() => setBait(null)} /> : null}
              {gearOther ? (
                <SelectedChip label={gearOther} tag="OTHER" onRemove={() => setGearOther(null)} />
              ) : null}
            </View>
          ) : null}
          <SearchPick
            placeholder="Search lures, rigs, bait…"
            options={GEAR_OPTIONS}
            onPick={onPickGear}
          />

          <Text style={styles.fieldLabel}>Size (optional)</Text>
          <TextInput
            value={size}
            onChangeText={setSize}
            placeholder='e.g. 18 in or 3.5 lb'
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Where, how, conditions…"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />

          <Text style={styles.fieldLabel}>Photo (optional)</Text>
          {photoUri ? (
            <View>
              <Image source={{ uri: photoUri }} style={styles.preview} />
              <Pressable onPress={() => setPhotoUri(null)}>
                <Text style={styles.removePhoto}>Remove photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.photoBtn, pressed && pressedStyle]}
              onPress={pickPhoto}
            >
              <View style={styles.photoBtnRow}>
                <Feather name="camera" size={16} color={colors.text} />
                <Text style={styles.photoBtnText}>Add a photo</Text>
              </View>
            </Pressable>
          )}

          {!editingId ? (
            <>
              <Text style={styles.fieldLabel}>Caught on</Text>
              <TextInput
                value={catchDate}
                onChangeText={setCatchDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.textMuted}
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.subLabel}>
                Change this to backdate a catch from an earlier day.
              </Text>
            </>
          ) : null}

          {editingId ? (
            catches.find((c) => c.id === editingId)?.conditions ? (
              <>
                <Text style={styles.fieldLabel}>Location label</Text>
                <TextInput
                  value={placeLabel}
                  onChangeText={setPlaceLabel}
                  placeholder="Where was this caught? (e.g. Balus Creek dock)"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                <Text style={styles.attachHint}>
                  The other conditions logged with this catch are kept as they were.
                </Text>
              </>
            ) : null
          ) : snapshot ? (
            <>
              <Pressable
                onPress={() => setAttachConditions((v) => !v)}
                style={({ pressed }) => [styles.attachRow, pressed && pressedStyle]}
              >
                <View style={[styles.check, attachConditions && styles.checkOn]}>
                  {attachConditions ? (
                    <Feather name="check" size={14} color={colors.card} />
                  ) : null}
                </View>
                <View style={styles.attachText}>
                  <Text style={styles.attachLabel}>Attach current conditions</Text>
                  <Text style={styles.attachPreview}>
                    {snapshot.place ? `${snapshot.place} · ` : ''}
                    {summarizeCatchConditions(snapshot)}
                  </Text>
                </View>
              </Pressable>
              {attachConditions ? (
                <>
                  <Text style={styles.fieldLabel}>Location label</Text>
                  <TextInput
                    value={placeLabel}
                    onChangeText={setPlaceLabel}
                    placeholder="Where was this caught? (e.g. Balus Creek dock)"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                  />
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.attachHint}>
              Run an analysis on the Plan tab first to attach live conditions to
              this catch.
            </Text>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSave}
            disabled={saving || !resolvedSpecies || !hasGear}
            style={({ pressed }) => [
              styles.cta,
              (saving || !resolvedSpecies || !hasGear) && styles.disabled,
              pressed && pressedStyle,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.ctaText}>{editingId ? 'Save changes' : 'Save catch'}</Text>
            )}
          </Pressable>
        </Section>
      )}

      {!loading && catches.length > 0 ? (
        <CatchReportCard catches={catches} forecast={forecast ?? null} />
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xl }} />
      ) : catches.length === 0 ? (
        <Text style={styles.empty}>
          No catches logged yet. Tap “Log a catch” after your next fish.
        </Text>
      ) : (
        catches.map((c) => (
          <View key={c.id} style={styles.card}>
            {c.photoUri ? (
              <Image source={{ uri: c.photoUri }} style={styles.thumb} />
            ) : null}
            <View style={styles.cardBody}>
              <View style={styles.cardHead}>
                <Text style={styles.cardSpecies}>{c.species}</Text>
                <View style={styles.cardActions}>
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && pressedStyle]}
                    onPress={() => {
                      setConfirmDeleteId(null);
                      onEdit(c);
                    }}
                  >
                    <Feather name="edit-2" size={14} color={colors.accent} />
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.deleteBtn,
                      pressed && pressedStyle,
                    ]}
                    onPress={() => setConfirmDeleteId(c.id)}
                  >
                    <Feather name="trash-2" size={14} color={colors.bad} />
                    <Text style={[styles.actionText, styles.deleteBtnText]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
              {confirmDeleteId === c.id ? (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>Delete this catch?</Text>
                  <Pressable
                    style={({ pressed }) => [styles.actionBtn, pressed && pressedStyle]}
                    onPress={() => setConfirmDeleteId(null)}
                  >
                    <Text style={styles.actionText}>Keep</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.confirmDeleteBtn,
                      pressed && pressedStyle,
                    ]}
                    onPress={() => {
                      setConfirmDeleteId(null);
                      void onDelete(c.id);
                    }}
                  >
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              ) : null}
              {[
                c.lure ? `Lure: ${c.lure}` : null,
                c.rig ? `Rig: ${c.rig}` : null,
                c.bait ? `Bait: ${c.bait}` : null,
                c.gearOther ? `Gear: ${c.gearOther}` : null,
              ]
                .filter(Boolean)
                .map((line, i) => (
                  <Text key={i} style={styles.cardLure}>
                    {line}
                  </Text>
                ))}
              <Text style={styles.cardMeta}>
                {formatDate(c.dateISO)}
                {c.size ? `  ·  ${c.size}` : ''}
              </Text>
              {c.notes ? <Text style={styles.cardNotes}>{c.notes}</Text> : null}
              {c.conditions ? (
                <Text style={styles.cardConditions}>
                  {c.conditions.place ? `${c.conditions.place} · ` : ''}
                  {summarizeCatchConditions(c.conditions)}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
      </View>
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** A picked species/gear entry: label, optional category tag, and an ✕. */
function SelectedChip({
  label,
  tag,
  onRemove,
}: {
  label: string;
  tag?: string;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onRemove}
      style={({ pressed }) => [styles.chip, styles.selChip, pressed && pressedStyle]}
    >
      <Text style={[styles.chipText, styles.chipTextActive]}>{label}</Text>
      {tag ? (
        <View style={styles.selChipTag}>
          <Text style={styles.selChipTagText}>{tag}</Text>
        </View>
      ) : null}
      <Feather name="x" size={13} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((colors, { shadow }) => ({
  screen: { flex: 1 },
  content: { paddingBottom: spacing.xl * 2 },
  body: { paddingHorizontal: spacing.lg },
  brand: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ctaText: {
    color: colors.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: { opacity: 0.5 },
  cancel: { color: colors.bad, fontWeight: '700', fontSize: 13 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  gearHeading: {
    color: colors.water,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  notice: {
    color: colors.warn,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.text },
  selChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    marginBottom: spacing.sm,
  },
  selChipTag: {
    backgroundColor: colors.chip,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
  },
  selChipTagText: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  input: {
    backgroundColor: colors.bgElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  photoBtn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoBtnText: { color: colors.text, fontWeight: '700' },
  photoBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  removePhoto: {
    color: colors.bad,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.accent,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.accent },
  checkMark: { color: colors.card, fontSize: 14, fontWeight: '900' },
  attachText: { flex: 1 },
  attachLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  attachPreview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  attachHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.lg,
    lineHeight: 17,
  },
  error: { color: colors.bad, fontSize: 13, marginTop: spacing.md },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    marginRight: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  cardBody: { flex: 1 },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardSpecies: { color: colors.text, fontSize: 16, fontWeight: '800', flex: 1 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  deleteBtn: { borderColor: colors.bad },
  deleteBtnText: { color: colors.bad },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  confirmText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  confirmDeleteBtn: { backgroundColor: colors.bad, borderColor: colors.bad },
  confirmDeleteText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  cardLure: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 2 },
  cardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  cardNotes: { color: colors.text, fontSize: 13, marginTop: spacing.sm, lineHeight: 18 },
  cardConditions: {
    color: colors.water,
    fontSize: 11,
    marginTop: spacing.sm,
    lineHeight: 15,
  },
}));
