// A reusable bottom sheet for the Plan tab's "tap a tile for detail" cards.
// It's a plain slide-up sheet over a dark scrim — simpler than the Tides &
// Bite sheet (which floats over a live map and can be drag-resized), because
// detail content just needs to open, scroll, and close. The children render
// exactly as they did inline, so moving a card in here changes nothing about
// how it works.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function DetailSheet({ visible, onClose, children }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Stay mounted through the close animation so the sheet slides out instead
  // of vanishing; unmount once it finishes.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMounted(false);
        },
      );
    }
  }, [visible, anim]);

  // Android's back button closes the sheet rather than leaving the screen.
  useEffect(() => {
    if (!mounted || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [mounted]);

  if (!mounted) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: anim }]}>
        <Pressable style={styles.scrimFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.grabRow}>
          <View style={styles.grab} />
        </View>
        <View style={styles.headRow}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Feather name="x" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const useStyles = makeStyles((c, t) => ({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  scrimFill: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '86%',
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.mode === 'dark' ? '#33443a' : c.cardBorder,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    elevation: 16,
    ...t.shadow.card,
  },
  grabRow: { alignItems: 'center', paddingVertical: spacing.xs + 2 },
  grab: {
    width: 52,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: c.textMuted,
    opacity: 0.6,
  },
  headRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { padding: spacing.xs },
  body: {},
  bodyContent: { paddingBottom: spacing.md },
}));
