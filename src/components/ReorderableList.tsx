import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, radius, spacing, useTheme } from '@/theme';

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** Uniform row height in px (content is laid out to this). */
  rowHeight: number;
  /** Vertical gap between rows in px. */
  gap?: number;
  /** Called with the new order after a drag settles. */
  onReorder: (items: T[]) => void;
  /** The row's main content (icon + label). This whole area is the drag/tap
   * zone: a quick tap runs `onItemPress`, a 1.5s hold starts a reorder. */
  renderItem: (item: T) => ReactNode;
  /** Quick tap on the main content (e.g. load the item). */
  onItemPress?: (item: T) => void;
  /** Trailing actions (e.g. a delete button) drawn to the right of the content
   * but outside the drag zone, so tapping them never starts a reorder. */
  renderTrailing?: (item: T) => ReactNode;
  /** Visual style for each row container (card bg/border), grip included. */
  rowStyle?: StyleProp<ViewStyle>;
  /** Fires true when a drag arms (reorder mode) and false when it settles, so
   * the parent can lock page scrolling while a row is being moved. */
  onActiveChange?: (active: boolean) => void;
}

/** Move an array element from one index to another (immutably). */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  if (it !== undefined) next.splice(to, 0, it);
  return next;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Hold a row this long before a drag starts, so a stray touch or a scroll
 * never reorders by accident. */
const HOLD_MS = 1500;

/** Finger travel (px) before the hold is treated as a scroll/tap, not a hold:
 * it cancels the pending arm and disqualifies the touch from being a tap. */
const MOVE_CANCEL = 8;

/** How much the picked-up row grows, to read as "lifted / magnified". */
const DRAG_SCALE = 1.06;

/**
 * A dependency-free drag-to-reorder vertical list (core PanResponder +
 * Animated only — no gesture-handler/reanimated). The whole row content is a
 * drag handle: pressing and holding it for 1.5s picks that row up (the grip on
 * the right does the same), the others open a gap where it will land, and
 * releasing commits the new order. A quick tap instead runs `onItemPress`.
 * Critically it refuses the responder-termination request once armed, so the
 * surrounding ScrollView can't steal the drag mid-gesture (which on native
 * otherwise made the row not move at all); before arming it lets go, so a
 * normal drag still scrolls the page.
 */
export function ReorderableList<T>({
  items,
  keyOf,
  rowHeight,
  gap = spacing.xs,
  onReorder,
  renderItem,
  onItemPress,
  renderTrailing,
  rowStyle,
  onActiveChange,
}: Props<T>) {
  const slot = rowHeight + gap;
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragIndexRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;

  const onStart = (index: number) => {
    dragIndexRef.current = index;
    hoverRef.current = index;
    dragY.setValue(0);
    setDragIndex(index);
    setHoverIndex(index);
    onActiveChangeRef.current?.(true);
  };
  const onMove = (dy: number) => {
    dragY.setValue(dy);
    const len = itemsRef.current.length;
    const from = dragIndexRef.current ?? 0;
    const hover = clamp(Math.round((from * slot + dy) / slot), 0, len - 1);
    if (hover !== hoverRef.current) {
      hoverRef.current = hover;
      setHoverIndex(hover);
    }
  };
  const onEnd = () => {
    const from = dragIndexRef.current;
    const to = hoverRef.current;
    dragIndexRef.current = null;
    hoverRef.current = null;
    dragY.setValue(0);
    setDragIndex(null);
    setHoverIndex(null);
    onActiveChangeRef.current?.(false);
    if (from != null && to != null && from !== to) {
      onReorderRef.current(move(itemsRef.current, from, to));
    }
  };

  return (
    <View style={{ height: items.length * slot - gap }}>
      {items.map((item, index) => (
        <DragRow
          key={keyOf(item)}
          index={index}
          slot={slot}
          rowHeight={rowHeight}
          dragIndex={dragIndex}
          hoverIndex={hoverIndex}
          dragY={dragY}
          rowStyle={rowStyle}
          onStart={onStart}
          onMove={onMove}
          onEnd={onEnd}
          onPress={onItemPress ? () => onItemPress(item) : undefined}
          trailing={renderTrailing?.(item)}
        >
          {renderItem(item)}
        </DragRow>
      ))}
    </View>
  );
}

interface RowProps {
  index: number;
  slot: number;
  rowHeight: number;
  dragIndex: number | null;
  hoverIndex: number | null;
  dragY: Animated.Value;
  rowStyle?: StyleProp<ViewStyle>;
  onStart: (index: number) => void;
  onMove: (dy: number) => void;
  onEnd: () => void;
  onPress?: () => void;
  trailing?: ReactNode;
  children: ReactNode;
}

function DragRow({
  index,
  slot,
  rowHeight,
  dragIndex,
  hoverIndex,
  dragY,
  rowStyle,
  onStart,
  onMove,
  onEnd,
  onPress,
  trailing,
  children,
}: RowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Refs so the once-created PanResponders always see the latest index and
  // callbacks (they are recreated each render of the parent).
  const indexRef = useRef(index);
  indexRef.current = index;
  const cbRef = useRef({ onStart, onMove, onEnd, onPress });
  cbRef.current = { onStart, onMove, onEnd, onPress };
  // Hold-to-drag: the drag only arms after HOLD_MS without much movement.
  const activeRef = useRef(false);
  const movedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const clearHold = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const finish = () => {
    clearHold();
    setHolding(false);
    if (activeRef.current) {
      activeRef.current = false;
      cbRef.current.onEnd();
    }
  };

  // One responder shape, used for both the content zone and the grip. Only the
  // content zone forwards a quick tap (to load the item); the grip never does.
  const makePan = (forwardTap: boolean) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Before the hold completes, let a real drag fall through to the page
      // scroll; once armed, refuse to hand the gesture back so the row drags.
      onPanResponderTerminationRequest: () => !activeRef.current,
      onShouldBlockNativeResponder: () => activeRef.current,
      onPanResponderGrant: () => {
        movedRef.current = false;
        setHolding(true);
        clearHold();
        timerRef.current = setTimeout(() => {
          activeRef.current = true;
          cbRef.current.onStart(indexRef.current);
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (activeRef.current) {
          cbRef.current.onMove(g.dy);
          return;
        }
        // Movement before arming means "scroll", not "hold": cancel the pending
        // arm and remember it moved, so the release isn't counted as a tap.
        if (Math.abs(g.dx) > MOVE_CANCEL || Math.abs(g.dy) > MOVE_CANCEL) {
          movedRef.current = true;
          clearHold();
          setHolding(false);
        }
      },
      onPanResponderRelease: () => {
        const wasActive = activeRef.current;
        const moved = movedRef.current;
        finish();
        // A quick, still press that never became a drag is a tap.
        if (forwardTap && !wasActive && !moved) cbRef.current.onPress?.();
      },
      onPanResponderTerminate: finish,
    });

  const bodyPan = useRef(makePan(true)).current;
  const gripPan = useRef(makePan(false)).current;

  const dragging = dragIndex === index;
  // Where this row rests while another row is dragged: rows between the
  // picked-up slot and the hover slot shift by one to open the gap.
  let base = index * slot;
  if (dragIndex != null && hoverIndex != null && !dragging) {
    if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) base -= slot;
    else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) base += slot;
  }
  const pos = dragging
    ? {
        top: dragIndex * slot,
        transform: [{ translateY: dragY }, { scale: DRAG_SCALE }],
        zIndex: 20,
        elevation: 6,
      }
    : { top: base, zIndex: 1 };

  return (
    <Animated.View
      style={[styles.row, { height: rowHeight }, rowStyle, dragging && styles.rowDragging, pos]}
    >
      <View style={[styles.body, holding && styles.bodyHolding]} {...bodyPan.panHandlers}>
        {children}
      </View>
      {trailing != null ? <View style={styles.trailing}>{trailing}</View> : null}
      <View
        style={styles.handle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        {...gripPan.panHandlers}
      >
        <Feather name="menu" size={18} color={holding || dragging ? colors.accent : colors.textMuted} />
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowDragging: {
    // A little lighter than the resting card so the picked-up row reads as
    // lifted off the surface, paired with the scale-up in `pos`.
    backgroundColor: c.card,
    borderRadius: radius.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  // The drag/tap zone — stretched to the full row height so the whole middle
  // is easy to grab-and-hold.
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.sm },
  // Pressed/holding feedback while a finger is down before it arms.
  bodyHolding: { opacity: 0.6 },
  // Trailing actions (delete); padding here + the grip's left padding open a
  // clear gap between the delete button and the reorder grip.
  trailing: { alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: spacing.sm },
  handle: {
    paddingRight: spacing.xs,
    paddingLeft: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
}));
