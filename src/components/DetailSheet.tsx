// A reusable bottom sheet for the Plan tab's "tap a tile for detail" cards.
// Two modes:
//  • floating (map-aware): FLOATS over the live screen — no grey scrim — so the
//    map (which the host scrolls into view as it opens) stays visible and
//    interactive above it, like the Tides & Bite sheet. Must be rendered at the
//    screen root so its bottom-anchored overlay lines up with the viewport.
//  • modal (default): a plain slide-up over a dark scrim, safe to render nested
//    (e.g. the conditions grid inside a card) because a Modal portals to root.
// Either way the children render exactly as they did inline.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  PanResponder,
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
  /** Float over the live screen (map stays interactive) instead of a Modal
   * scrim. Only use when rendered at the screen root. */
  floating?: boolean;
}

/** Flick-to-dismiss: release faster than this (px/ms) AND travelled this far. */
const DISMISS_VELOCITY = 0.85;
const DISMISS_DISTANCE = 60;
/** How short the sheet can be dragged (same feel as the Tides & Bite sheet). */
const MIN_SHEET_H = 160;

export function DetailSheet({ visible, onClose, children, floating = false }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Stay mounted through the close animation so the sheet slides out instead
  // of vanishing; unmount once it finishes.
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Dragged sheet height; null = fit the content (up to maxHeight). Same
  // mechanic as the Tides & Bite sheet: pull the grab handle down for a
  // shorter sheet, back up to snap to content-fit.
  const [sheetH, setSheetH] = useState<number | null>(null);
  const sheetHRef = useRef<number | null>(null);
  const naturalH = useRef(0); // last laid-out height, the drag ceiling
  const dragBase = useRef(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Every open starts at the default (content-fit) height.
      sheetHRef.current = null;
      setSheetH(null);
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

  // Grab-handle drag: pull down/up to resize the sheet live (shrink-only —
  // the content-fit height is the ceiling). A fast flick down dismisses; a
  // fast flick up snaps back to the default height.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        dragBase.current = sheetHRef.current ?? naturalH.current;
      },
      onPanResponderMove: (_e, g) => {
        const maxH = naturalH.current || Dimensions.get('window').height * 0.82;
        const h = Math.min(maxH, Math.max(MIN_SHEET_H, dragBase.current - g.dy));
        const next = h >= maxH - 2 ? null : h;
        sheetHRef.current = next;
        setSheetH(next);
      },
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.vy) > DISMISS_VELOCITY && Math.abs(g.dy) > DISMISS_DISTANCE) {
          if (g.dy > 0) {
            onCloseRef.current();
          } else {
            sheetHRef.current = null;
            setSheetH(null);
          }
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  const sheet = (
    <Animated.View
      style={[styles.sheet, sheetH != null && { height: sheetH }, { transform: [{ translateY }] }]}
      onLayout={(e) => {
        // Only record the content-fit height while no custom height is
        // applied — otherwise the drag ceiling would shrink to wherever the
        // sheet was last dragged.
        if (sheetHRef.current == null) {
          naturalH.current = e.nativeEvent.layout.height;
        }
      }}
    >
      <View style={styles.grabRow} {...pan.panHandlers}>
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
  );

  if (floating) {
    // A floating overlay, NOT a Modal: box-none lets taps above the sheet reach
    // the map/page so the screen behind stays live instead of greyed out.
    return (
      <View style={styles.floatOverlay} pointerEvents="box-none">
        {sheet}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.scrim, { opacity: anim }]}>
        <Pressable style={styles.scrimFill} onPress={onClose} />
      </Animated.View>
      {sheet}
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
  // Floating mode: a FULL-SCREEN box-none overlay (top:0 too, so the
  // bottom-anchored sheet inside has a full-height box to pin against);
  // box-none lets taps above the sheet reach the live map.
  floatOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 800,
    maxHeight: '82%',
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
