import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * The one button used across the app. Primary is a foliage-green gradient that
 * lifts off the page with a soft colored shadow; secondary is a tinted fill;
 * ghost is text-only. Keeps every tappable action consistent.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
}: Props) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const isPrimary = variant === 'primary';
  const textColor =
    isPrimary ? colors.onAccent : variant === 'secondary' ? colors.text : colors.accent;

  const content = loading ? (
    <ActivityIndicator color={textColor} />
  ) : (
    <View style={styles.inner}>
      {icon ? <Feather name={icon} size={17} color={textColor} /> : null}
      <Text style={[styles.label, { color: textColor }]}>{title}</Text>
    </View>
  );

  if (isPrimary) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.shadowWrap,
          { shadowColor: colors.accentDeep },
          disabled && styles.disabled,
          pressed && pressedStyle,
        ]}
      >
        <LinearGradient
          colors={gradients.button}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.fill}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.fill,
        variant === 'secondary' ? styles.secondary : styles.ghost,
        disabled && styles.disabled,
        pressed && pressedStyle,
      ]}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  shadowWrap: {
    borderRadius: radius.lg,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 5,
    marginBottom: spacing.md,
  },
  fill: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: { fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  secondary: {
    backgroundColor: c.accentDim,
    borderWidth: 1,
    borderColor: c.accent,
  },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
}));
