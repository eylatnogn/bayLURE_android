import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { Logo } from '@/components/Logo';
import { colors as fallback, fonts, radius, spacing, useTheme } from '@/theme';

interface Props {
  /** Main heading. The wordmark for the planner, or a screen title. */
  heading: string;
  subtitle: string;
  /** Optional version chip (planner only). */
  version?: string;
  /** Use the serif display face for the heading (brand wordmark). */
  display?: boolean;
  /** Show the light/dark toggle (planner header only). */
  showThemeToggle?: boolean;
}

export function BrandHeader({
  heading,
  subtitle,
  version,
  display,
  showThemeToggle,
}: Props) {
  const { gradients, mode, toggle } = useTheme();
  const onDark = fallback.onDark;
  const onDarkMuted = fallback.onDarkMuted;

  return (
    <LinearGradient
      colors={gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.header}
    >
      {/* Faint water motif tucked into the bottom of the header. */}
      <Svg
        width="100%"
        height={46}
        viewBox="0 0 100 46"
        preserveAspectRatio="none"
        style={styles.wave}
        pointerEvents="none"
      >
        <Path d="M0 30 Q12 22 25 30 T50 30 T75 30 T100 30 V46 H0Z" fill={onDark} opacity={0.1} />
        <Path d="M0 37 Q12 30 25 37 T50 37 T75 37 T100 37 V46 H0Z" fill={onDark} opacity={0.07} />
      </Svg>

      {showThemeToggle ? (
        <Pressable
          onPress={toggle}
          hitSlop={10}
          style={styles.toggle}
          accessibilityLabel="Toggle light or dark theme"
        >
          <Feather name={mode === 'dark' ? 'sun' : 'moon'} size={18} color={onDark} />
        </Pressable>
      ) : null}

      <View style={styles.row}>
        <Logo size={44} color={onDark} accent="#8fd0a6" />
        <View style={styles.titles}>
          <View style={styles.headingRow}>
            <Text
              style={[styles.heading, { color: onDark }, display && styles.headingDisplay]}
              numberOfLines={1}
            >
              {heading}
            </Text>
            {version ? (
              <Text style={[styles.version, { color: onDarkMuted, borderColor: onDarkMuted }]}>
                v{version}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: onDarkMuted }]}>{subtitle}</Text>
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
    overflow: 'hidden',
  },
  wave: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  toggle: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
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
    fontSize: 11,
    fontWeight: '700',
    marginLeft: spacing.sm,
    marginBottom: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
