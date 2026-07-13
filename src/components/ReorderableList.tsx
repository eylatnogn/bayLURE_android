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
  /** Row body (the drag handle is drawn by this component alongside it). */
  renderItem: (item: T) => ReactNode;
  /** Visual style for each row container (card bg/border), grip included. */
  rowStyle?: StyleProp<ViewStyle>;
}

/** Move an array element from one index to another (immutably). */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  if (it !== undefined) next.splice(to, 0, it);
  return next;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Hold the grip this long before a drag starts, so a stray touch or a scroll
 * never reorders by accident. */
const HOLD_MS = 2000;

/**
 * A dependency-free drag-to-reorder vertical list (core PanResponder +
 * Animated only — no gesture-handler/reanimated). Each row owns its own
 * PanResponder on its grip handle, so grabbing a grip picks that exact row
 * up, the others open a gap where it will land, and releasing commits the new
 * order. Critically it refuses the responder-termination request, so the
 * surrounding ScrollView can't steal the drag mid-gesture (which on native
 * otherwise made the row not move at all).
 */
export function ReorderableList<T>({
  items,
  keyOf,
  rowHeight,
  gap = spacing.xs,
  onReorder,
  renderItem,
  rowStyle,
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

  const onStart = (index: number) => {
    dragIndexRef.current = index;
    hoverRef.current = index;
    dragY.setValue(0);
    setDragIndex(index);
    setHoverIndex(index);
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
  children,
}: RowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Refs so the once-created PanResponder always sees the latest index and
  // callbacks (they are recreated each render of the parent).
  const indexRef = useRef(index);
  indexRef.current = index;
  const cbRef = useRef({ onStart, onMove, onEnd });
  cbRef.current = { onStart, onMove, onEnd };
  // Hold-to-drag: the drag only arms after HOLD_MS on the grip.
  const activeRef = useRef(false);
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

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Before the hold completes, let a real drag fall through to the page
      // scroll; once armed, refuse to hand the gesture back so the row drags.
      onPanResponderTerminationRequest: () => !activeRef.current,
      onShouldBlockNativeResponder: () => activeRef.current,
      onPanResponderGrant: () => {
        setHolding(true);
        clearHold();
        timerRef.current = setTimeout(() => {
          activeRef.current = true;
          cbRef.current.onStart(indexRef.current);
        }, HOLD_MS);
      },
      onPanResponderMove: (_e, g) => {
        if (activeRef.current) cbRef.current.onMove(g.dy);
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }),
  ).current;

  const dragging = dragIndex === index;
  // Where this row rests while another row is dragged: rows between the
  // picked-up slot and the hover slot shift by one to open the gap.
  let base = index * slot;
  if (dragIndex != null && hoverIndex != null && !dragging) {
    if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) base -= slot;
    else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) base += slot;
  }
  const pos = dragging
    ? { top: dragIndex * slot, transform: [{ translateY: dragY }], zIndex: 20, elevation: 6 }
    : { top: base, zIndex: 1 };

  return (
    <Animated.View
      style={[styles.row, { height: rowHeight }, rowStyle, dragging && styles.rowDragging, pos]}
    >
      <View style={styles.body}>{children}</View>
      <View
        style={styles.handle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        {...pan.panHandlers}
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
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  handle: {
    paddingHorizontal: spacing.xs,
    paddingLeft: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
}));
