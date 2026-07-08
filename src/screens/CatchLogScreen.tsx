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
import * as ImageManipulator from 'expo-image-manipulator';
import type { CatchConditions, CatchRecord } from '@/types';
import { SPECIES } from '@/engine/species';
import { addCatch, deleteCatch, loadCatches, updateCatch } from '@/storage/catchLog';
import { summarizeCatchConditions } from '@/utils/snapshot';
import { LureSelect } from '@/components/LureSelect';
import { Section } from '@/components/Section';
import { BrandHeader } from '@/components/BrandHeader';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

const SPECIES_OPTIONS = [...SPECIES.map((s) => s.label), 'Other'];

interface Props {
  /** Latest analyzed conditions from the planner, offered for attaching. */
  snapshot?: CatchConditions | null;
}

export function CatchLogScreen({ snapshot }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  // Set while editing an existing catch (vs. logging a new one).
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Form state
  const [species, setSpecies] = useState<string | null>(null);
  const [speciesOther, setSpeciesOther] = useState('');
  const [lure, setLure] = useState<string | null>(null);
  const [rig, setRig] = useState<string | null>(null);
  const [bait, setBait] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attachConditions, setAttachConditions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void loadCatches().then((list) => {
      setCatches(list);
      setLoading(false);
    });
  }, []);

  const resetForm = useCallback(() => {
    setSpecies(null);
    setSpeciesOther('');
    setLure(null);
    setRig(null);
    setBait(null);
    setSize('');
    setNotes('');
    setPhotoUri(null);
    setEditingId(null);
    setError(null);
  }, []);

  const resolvedSpecies =
    species === 'Other' ? speciesOther.trim() : species ?? '';
  const hasGear = !!(lure || rig || bait);

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
      const context = ImageManipulator.manipulate(asset.uri);
      context.resize({ width: 700, height: null });
      const rendered = await context.renderAsync();
      const manipulated = await rendered.saveAsync({
        compress: 0.4,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: wantsBase64,
      });
      // On web, persist a small data URL so the photo survives a reload; on
      // native the resized file URI in the app sandbox is fine.
      if (wantsBase64 && manipulated.base64) {
        setPhotoUri(`data:image/jpeg;base64,${manipulated.base64}`);
      } else {
        setPhotoUri(manipulated.uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the photo library.');
    }
  }, []);

  const onSave = useCallback(async () => {
    if (!resolvedSpecies) {
      setError(
        species === 'Other'
          ? 'Type the species name.'
          : 'Pick a species.',
      );
      return;
    }
    if (!hasGear) {
      setError('Pick at least one of lure, rig, or bait.');
      return;
    }
    setSaving(true);
    setError(null);

    // When editing, keep the conditions and date the catch was first logged.
    const original = editingId ? catches.find((c) => c.id === editingId) : undefined;
    const record = {
      species: resolvedSpecies,
      lure: lure ?? undefined,
      rig: rig ?? undefined,
      bait: bait ?? undefined,
      size: size.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUri: photoUri ?? undefined,
      conditions: editingId
        ? original?.conditions
        : attachConditions && snapshot
          ? snapshot
          : undefined,
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
  }, [resolvedSpecies, species, hasGear, lure, rig, bait, size, notes, photoUri, attachConditions, snapshot, editingId, catches, resetForm]);

  const onDelete = useCallback(async (id: string) => {
    const next = await deleteCatch(id);
    setCatches(next);
  }, []);

  const onEdit = useCallback((c: CatchRecord) => {
    setNotice(null);
    setError(null);
    const known = c.species !== 'Other' && SPECIES_OPTIONS.includes(c.species);
    setSpecies(known ? c.species : 'Other');
    setSpeciesOther(known ? '' : c.species);
    setLure(c.lure ?? null);
    setRig(c.rig ?? null);
    setBait(c.bait ?? null);
    setSize(c.size ?? '');
    setNotes(c.notes ?? '');
    setPhotoUri(c.photoUri ?? null);
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
          <View style={styles.chipWrap}>
            {SPECIES_OPTIONS.map((label) => {
              const active = species === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => setSpecies(label)}
                  style={({ pressed }) => [
                    styles.chip,
                    active && styles.chipActive,
                    pressed && pressedStyle,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {species === 'Other' ? (
            <TextInput
              value={speciesOther}
              onChangeText={setSpeciesOther}
              placeholder="Type the species (e.g. Bowfin, Sheepshead)"
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={[styles.input, { marginTop: spacing.sm }]}
            />
          ) : null}

          <Text style={styles.fieldLabel}>What caught it?</Text>
          <Text style={styles.subLabel}>Pick any that apply — tap again to clear.</Text>

          <Text style={styles.gearHeading}>Lure</Text>
          <LureSelect value={lure} onChange={setLure} category="lure" />
          <Text style={styles.gearHeading}>Rig</Text>
          <LureSelect value={rig} onChange={setRig} category="rig" />
          <Text style={styles.gearHeading}>Bait</Text>
          <LureSelect value={bait} onChange={setBait} category="bait" />

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

          {editingId ? (
            catches.find((c) => c.id === editingId)?.conditions ? (
              <Text style={styles.attachHint}>
                The conditions logged with this catch are kept as they were.
              </Text>
            ) : null
          ) : snapshot ? (
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
                  <Pressable onPress={() => onEdit(c)} hitSlop={8}>
                    <Text style={styles.edit}>Edit</Text>
                  </Pressable>
                  <Pressable onPress={() => onDelete(c.id)} hitSlop={8}>
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                </View>
              </View>
              {[
                c.lure ? `Lure: ${c.lure}` : null,
                c.rig ? `Rig: ${c.rig}` : null,
                c.bait ? `Bait: ${c.bait}` : null,
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
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  edit: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  delete: { color: colors.bad, fontSize: 12, fontWeight: '700' },
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
