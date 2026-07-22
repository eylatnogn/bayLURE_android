// The bayLURE Pro upsell sheet, shown when a free user hits a save limit (or
// taps an upgrade affordance). Kept as one self-contained modal so any screen
// can trigger it through usePro().showPaywall().
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { FREE_LIMITS, usePro } from '@/purchases/pro';
import { fonts, makeStyles, radius, spacing, useTheme } from '@/theme';

const PERKS: Array<{ icon: keyof typeof Feather.glyphMap; text: string }> = [
  { icon: 'calendar', text: 'Full 7-day forecast (free: today + tomorrow)' },
  { icon: 'map-pin', text: 'Unlimited saved spots' },
  { icon: 'sliders', text: 'Unlimited condition presets' },
  { icon: 'book-open', text: 'Unlimited catch log entries' },
  { icon: 'zap', text: 'No ads' },
];

export function Paywall() {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const {
    paywallVisible,
    hidePaywall,
    subscribe,
    restore,
    redeem,
    priceString,
    busy,
    canSubscribe,
  } = usePro();
  const [notice, setNotice] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');

  const onRedeem = async () => {
    if (!code.trim()) return;
    setNotice(null);
    const ok = await redeem(code);
    if (ok) {
      setCode('');
      setCodeOpen(false);
    } else {
      setNotice("That code didn't match. Check it and try again.");
    }
  };

  const onSubscribe = async () => {
    setNotice(null);
    try {
      await subscribe();
    } catch {
      setNotice('The purchase could not be completed. Nothing was charged — please try again.');
    }
  };

  const onRestore = async () => {
    setNotice(null);
    const result = await restore();
    if (result === 'none') setNotice('No previous subscription found for this Google account.');
    if (result === 'error') setNotice('Could not reach Google Play to restore. Try again later.');
  };

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      transparent
      onRequestClose={hidePaywall}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={gradients.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.brand}>bayLURE Pro</Text>
            <Text style={styles.tagline}>Fish smarter. Keep everything.</Text>
          </LinearGradient>

          <ScrollView bounces={false} contentContainerStyle={styles.body}>
            {PERKS.map((p) => (
              <View key={p.text} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <Feather name={p.icon} size={16} color={colors.accent} />
                </View>
                <Text style={styles.perkText}>{p.text}</Text>
              </View>
            ))}

            <Text style={styles.freeNote}>
              Free includes {FREE_LIMITS.spots} saved spot, {FREE_LIMITS.presets} preset, and{' '}
              {FREE_LIMITS.catches} logged catches. Everything you have already saved stays
              yours either way.
            </Text>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <Button
              title={
                canSubscribe
                  ? `Try Pro free for 2 weeks — then ${priceString}/month`
                  : 'Subscriptions coming soon'
              }
              icon="anchor"
              onPress={onSubscribe}
              disabled={!canSubscribe}
              loading={busy}
            />
            {canSubscribe ? (
              <Button title="Restore purchases" variant="ghost" onPress={onRestore} disabled={busy} />
            ) : null}

            {codeOpen ? (
              <View style={styles.codeRow}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={setCode}
                  placeholder="Redeem code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  onSubmitEditing={onRedeem}
                />
                <Pressable
                  onPress={onRedeem}
                  style={({ pressed }) => [styles.codeApply, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.codeApplyText}>Apply</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setCodeOpen(true)} hitSlop={8} style={styles.closeRow}>
                <Text style={styles.codeLink}>Have a redeem code?</Text>
              </Pressable>
            )}

            <Pressable onPress={hidePaywall} hitSlop={8} style={styles.closeRow}>
              <Text style={styles.closeText}>Not now</Text>
            </Pressable>

            {canSubscribe ? (
              <Text style={styles.finePrint}>
                First 2 weeks free, then {priceString}/month, auto-renewing until
                canceled. Cancel before the trial ends and you won't be charged.
                Manage or cancel anytime in Google Play → Subscriptions.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, t) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 12, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
    maxHeight: '88%',
    ...t.shadow.card,
  },
  header: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  brand: {
    fontFamily: fonts.displayBold,
    fontSize: 28,
    color: c.onDark,
  },
  tagline: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: c.onDarkMuted,
  },
  body: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  perkIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: c.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.text,
  },
  freeNote: {
    fontSize: 13,
    lineHeight: 18,
    color: c.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  notice: {
    fontSize: 13,
    color: c.errorText,
    backgroundColor: c.errorBg,
    borderColor: c.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  closeRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  codeLink: {
    fontSize: 13,
    fontWeight: '700',
    color: c.accent,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.cardBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: c.text,
    backgroundColor: c.bgElevated,
  },
  codeApply: {
    borderRadius: radius.md,
    backgroundColor: c.accentDim,
    borderWidth: 1,
    borderColor: c.accent,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeApplyText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textMuted,
  },
  finePrint: {
    fontSize: 11,
    lineHeight: 15,
    color: c.textMuted,
    textAlign: 'center',
  },
}));
