import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

interface Props {
  title: string;
  /** Optional leading icon shown in an accent chip. */
  icon?: keyof typeof Feather.glyphMap;
  right?: ReactNode;
  children: ReactNode;
}

export function Section({ title, icon, right, children }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.iconChip}>
              <Feather name={icon} size={13} color={colors.accent} />
            </View>
          ) : (
            <View style={styles.tick} />
          )}
          <Text style={styles.title}>{title}</Text>
        </View>
        {right}
      </View>
      <View style={styles.divider} />
      {children}
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  card: {
    backgroundColor: c.card,
    borderColor: c.cardBorder,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...t.shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  iconChip: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: c.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    width: 3,
    height: 13,
    borderRadius: 2,
    backgroundColor: c.accent,
  },
  title: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: c.cardBorder,
    opacity: 0.7,
    marginBottom: spacing.md,
  },
}));
