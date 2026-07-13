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

/**
 * A dependency-free drag-to-reorder vertical list (core PanResponder +
 * Animated only — no gesture-handler/reanimated). Rows are absolutely
 * positioned in fixed-height slots; grabbing a row's grip handle picks it up,
 * the other rows open a gap where it will land, and releasing commits the new
 * order. The handle claims the touch on start so a drag never scrolls the
 * surrounding page.
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
  const { colors } = useTheme();
  const styles = useStyles();
  const slot = rowHeight + gap;

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndex = useRef(0);
  const containerTop = useRef(0);
  const containerRef = useRef<View>(null);
  // Latest values for the once-created PanResponder to read.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const hoverRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const measure = () => {
    containerRef.current?.measureInWindow((_x, y) => {
      containerTop.current = y;
    });
  };

  const pan = useRef(
    PanResponder.create({
      // The handlers are only spread onto each row's grip, so claiming on
      // start means grabbing the grip owns the gesture (page won't scroll).
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const len = itemsRef.current.length;
        const i = clamp(Math.floor((e.nativeEvent.pageY - containerTop.current) / slot), 0, len - 1);
        startIndex.current = i;
        hoverRef.current = i;
        dragY.setValue(0);
        setDragKey(keyOf(itemsRef.current[i]!));
        setHoverIndex(i);
      },
      onPanResponderMove: (_e, g) => {
        dragY.setValue(g.dy);
        const len = itemsRef.current.length;
        const hover = clamp(Math.round((startIndex.current * slot + g.dy) / slot), 0, len - 1);
        if (hover !== hoverRef.current) {
          hoverRef.current = hover;
          setHoverIndex(hover);
        }
      },
      onPanResponderRelease: () => {
        const from = startIndex.current;
        const to = hoverRef.current ?? from;
        setDragKey(null);
        setHoverIndex(null);
        dragY.setValue(0);
        if (from !== to) onReorderRef.current(move(itemsRef.current, from, to));
      },
      onPanResponderTerminate: () => {
        setDragKey(null);
        setHoverIndex(null);
        dragY.setValue(0);
      },
    }),
  ).current;

  return (
    <View
      ref={containerRef}
      onLayout={measure}
      style={{ height: items.length * slot - gap }}
    >
      {items.map((item, index) => {
        const key = keyOf(item);
        const dragging = key === dragKey;
        // Where this row sits while another row is being dragged: rows between
        // the picked-up slot and the hover slot shift by one to open the gap.
        let base = index * slot;
        if (dragKey && hoverIndex != null && !dragging) {
          const from = startIndex.current;
          const to = hoverIndex;
          if (from < to && index > from && index <= to) base -= slot;
          else if (from > to && index >= to && index < from) base += slot;
        }
        const posStyle = dragging
          ? {
              top: startIndex.current * slot,
              transform: [{ translateY: dragY }],
              zIndex: 20,
              elevation: 6,
            }
          : { top: base, zIndex: 1 };
        return (
          <Animated.View
            key={key}
            style={[styles.row, { height: rowHeight }, rowStyle, dragging && styles.rowDragging, posStyle]}
          >
            <View style={styles.body}>{renderItem(item)}</View>
            <View
              style={styles.handle}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              {...pan.panHandlers}
            >
              <Feather name="menu" size={18} color={colors.textMuted} />
            </View>
          </Animated.View>
        );
      })}
    </View>
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
