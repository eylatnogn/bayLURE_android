import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Region } from '@/api/geocode';
import { regulationsForState } from '@/engine/regulations';
import { Section } from '@/components/Section';
import { colors, radius, spacing } from '@/theme';

interface Props {
  region: Region | null;
}

export function RegulationsCard({ region }: Props) {
  const isUS = region?.countryCode?.toLowerCase() === 'us';
  const reg = isUS ? regulationsForState(region?.state) : null;

  const fallbackQuery = encodeURIComponent(
    `${region?.state ? region.state + ' ' : ''}fishing regulations size and bag limits`,
  );
  const fallbackUrl = `https://www.google.com/search?q=${fallbackQuery}`;

  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <Section title="Regulations & Limits">
      {reg ? (
        <>
          <Text style={styles.lead}>
            Size, bag, and season limits for{' '}
            <Text style={styles.state}>{reg.state}</Text> are set by the state —
            check the official source before you keep a fish.
          </Text>
          <Pressable style={styles.btn} onPress={() => open(reg.url)}>
            <Text style={styles.btnText}>
              Open official {reg.state} fishing regulations  ↗
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.lead}>
            {region?.state
              ? `We don't have a direct regulations link for ${region.state} yet.`
              : 'Set or analyze a location to look up local regulations.'}{' '}
            Always confirm size and bag limits with the local authority.
          </Text>
          <Pressable style={styles.btn} onPress={() => open(fallbackUrl)}>
            <Text style={styles.btnText}>Search official regulations  ↗</Text>
          </Pressable>
        </>
      )}
      <Text style={styles.disclaimer}>
        Limits change by species, water body, and season. bayLURE links to the
        authority but does not guarantee current rules — you are responsible for
        compliance.
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  lead: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  state: { fontWeight: '800' },
  btn: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  btnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.md,
    opacity: 0.85,
  },
});
