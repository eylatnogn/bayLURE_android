import { useCallback, useEffect, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import type { CatchConditions, CatchRecord } from '@/types';
import { LURES } from '@/engine/lureDatabase';
import { SPECIES } from '@/engine/species';
import { addCatch, deleteCatch, loadCatches } from '@/storage/catchLog';
import { summarizeCatchConditions } from '@/utils/snapshot';
import { LureSelect } from '@/components/LureSelect';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

const SPECIES_OPTIONS = [...SPECIES.map((s) => s.label), 'Other'];

interface Props {
  /** Latest analyzed conditions from the planner, offered for attaching. */
  snapshot?: CatchConditions | null;
}

export function CatchLogScreen({ snapshot }: Props) {
  const [catches, setCatches] = useState<CatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [species, setSpecies] = useState<string | null>(null);
  const [lure, setLure] = useState<string | null>(null);
  const [size, setSize] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [attachConditions, setAttachConditions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCatches().then((list) => {
      setCatches(list);
      setLoading(false);
    });
  }, []);

  const resetForm = useCallback(() => {
    setSpecies(null);
    setLure(null);
    setSize('');
    setNotes('');
    setPhotoUri(null);
    setError(null);
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.4,
        base64: Platform.OS === 'web',
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) return;
      // On web, persist a data URL so the photo survives a reload; on native
      // the file URI in the app sandbox is fine.
      if (Platform.OS === 'web' && asset.base64) {
        setPhotoUri(`data:image/jpeg;base64,${asset.base64}`);
      } else {
        setPhotoUri(asset.uri);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the photo library.');
    }
  }, []);

  const onSave = useCallback(async () => {
    if (!species || !lure) {
      setError('Pick a species and the lure that caught it.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const entry = LURES.find((l) => l.name === lure);
      const next = await addCatch({
        species,
        lure,
        lureCategory: entry?.category,
        waterType: entry?.waterTypes.length === 1 ? entry.waterTypes[0] : undefined,
        size: size.trim() || undefined,
        notes: notes.trim() || undefined,
        photoUri: photoUri ?? undefined,
        conditions: attachConditions && snapshot ? snapshot : undefined,
      });
      setCatches(next);
      resetForm();
      setFormOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the catch.');
    } finally {
      setSaving(false);
    }
  }, [species, lure, size, notes, photoUri, attachConditions, snapshot, resetForm]);

  const onDelete = useCallback(async (id: string) => {
    const next = await deleteCatch(id);
    setCatches(next);
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>Catch Log</Text>
      <Text style={styles.tagline}>
        Log what you catch and the lure that did it. It all stays on your device.
      </Text>

      {!formOpen ? (
        <Pressable style={styles.cta} onPress={() => setFormOpen(true)}>
          <Text style={styles.ctaText}>＋ Log a catch</Text>
        </Pressable>
      ) : (
        <Section
          title="New Catch"
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
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Lure / rig / bait used</Text>
          <LureSelect value={lure} onChange={setLure} />

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
            <Pressable style={styles.photoBtn} onPress={pickPhoto}>
              <Text style={styles.photoBtnText}>📷 Add a photo</Text>
            </Pressable>
          )}

          {snapshot ? (
            <Pressable
              onPress={() => setAttachConditions((v) => !v)}
              style={styles.attachRow}
            >
              <View style={[styles.check, attachConditions && styles.checkOn]}>
                {attachConditions ? <Text style={styles.checkMark}>✓</Text> : null}
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
            disabled={saving || !species || !lure}
            style={[styles.cta, (saving || !species || !lure) && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.ctaText}>Save catch</Text>
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
                <Pressable onPress={() => onDelete(c.id)} hitSlop={8}>
                  <Text style={styles.delete}>Delete</Text>
                </Pressable>
              </View>
              <Text style={styles.cardLure}>
                {c.lure}
                {c.lureCategory ? `  ·  ${c.lureCategory}` : ''}
              </Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl * 2,
  },
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
  ctaText: {
    color: colors.card,
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
    alignItems: 'center',
  },
  photoBtnText: { color: colors.text, fontWeight: '700' },
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
});
