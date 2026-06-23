import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '@/components/Logo';
import { colors, fonts, gradients, radius, spacing } from '@/theme';

interface Props {
  /** Main heading. The wordmark for the planner, or a screen title. */
  heading: string;
  subtitle: string;
  /** Optional version chip (planner only). */
  version?: string;
  /** Use the serif display face for the heading (brand wordmark). */
  display?: boolean;
}

export function BrandHeader({ heading, subtitle, version, display }: Props) {
  return (
    <LinearGradient
      colors={gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      <View style={styles.row}>
        <Logo size={44} color={colors.onDark} accent="#8fd0a6" />
        <View style={styles.titles}>
          <View style={styles.headingRow}>
            <Text
              style={[styles.heading, display && styles.headingDisplay]}
              numberOfLines={1}
            >
              {heading}
            </Text>
            {version ? <Text style={styles.version}>v{version}</Text> : null}
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titles: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heading: {
    color: colors.onDark,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headingDisplay: {
    fontFamily: fonts.displayBold,
    letterSpacing: 1,
    fontSize: 28,
  },
  version: {
    color: colors.onDarkMuted,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: spacing.sm,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.onDarkMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
