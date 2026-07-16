import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, View } from 'react-native';

interface Props<T> {
  items: T[];
  keyOf: (item: T) => string;
  /** Row height in px; each tile is slotWidth × height. */
  height: number;
  /** New order after a drag settles. */
  onReorder: (items: T[]) => void;
  /** Tile content (icon + label). The whole tile is the drag handle. */
  renderItem: (item: T, dragging: boolean) => ReactNode;
}

/** Move an array element from one index to another (immutably). */
function move<T>(list: T[], from: number, to: number): T[] {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  if (it !== undefined) next.splice(to, 0, it);
  return next;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** How much a picked-up tile grows, to read as "lifted". */
const DRAG_SCALE = 1.1;

/**
 * A dependency-free HORIZONTAL drag-to-reorder row (PanResponder + Animated
 * only) — the strip version of {@link ReorderableList}. It splits its measured
 * width into equal slots, one per item, and lets you grab a tile and slide it
 * left/right; the others open a gap where it will land. Unlike the list, the
 * drag arms immediately (no hold): it's only mounted inside an explicit
 * "reorder" mode, so there's no page-scroll gesture to disambiguate from.
 */
export function ReorderableStrip<T>({ items, keyOf, height, onReorder, renderItem }: Props<T>) {
  const [width, setWidth] = useState(0);
  const n = items.length;
  const slot = n > 0 && width > 0 ? width / n : 0;

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragX = useRef(new Animated.Value(0)).current;
  const dragIndexRef = useRef<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const slotRef = useRef(slot);
  slotRef.current = slot;

  const onStart = (index: number) => {
    dragIndexRef.current = index;
    hoverRef.current = index;
    dragX.setValue(0);
    setDragIndex(index);
    setHoverIndex(index);
  };
  const onMove = (dx: number) => {
    dragX.setValue(dx);
    const s = slotRef.current || 1;
    const from = dragIndexRef.current ?? 0;
    const hover = clamp(Math.round((from * s + dx) / s), 0, itemsRef.current.length - 1);
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
    dragX.setValue(0);
    setDragIndex(null);
    setHoverIndex(null);
    if (from != null && to != null && from !== to) {
      onReorderRef.current(move(itemsRef.current, from, to));
    }
  };

  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {slot > 0
        ? items.map((item, index) => (
            <DragTile
              key={keyOf(item)}
              index={index}
              slot={slot}
              height={height}
              dragIndex={dragIndex}
              hoverIndex={hoverIndex}
              dragX={dragX}
              onStart={onStart}
              onMove={onMove}
              onEnd={onEnd}
            >
              {renderItem(item, dragIndex === index)}
            </DragTile>
          ))
        : null}
    </View>
  );
}

interface TileProps {
  index: number;
  slot: number;
  height: number;
  dragIndex: number | null;
  hoverIndex: number | null;
  dragX: Animated.Value;
  onStart: (index: number) => void;
  onMove: (dx: number) => void;
  onEnd: () => void;
  children: ReactNode;
}

function DragTile({
  index,
  slot,
  height,
  dragIndex,
  hoverIndex,
  dragX,
  onStart,
  onMove,
  onEnd,
  children,
}: TileProps) {
  const indexRef = useRef(index);
  indexRef.current = index;
  const cbRef = useRef({ onStart, onMove, onEnd });
  cbRef.current = { onStart, onMove, onEnd };
  const activeRef = useRef(false);

  const pan = useRef(
    PanResponder.create({
      // Claim on MOVE, not on touch-start, so a quick tap falls through to a
      // nested control (the remove "×" on the tile); a real drag still grabs.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      // Hold the gesture once grabbed so nothing steals it mid-drag.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        activeRef.current = true;
        cbRef.current.onStart(indexRef.current);
      },
      onPanResponderMove: (_e, g) => {
        if (activeRef.current) cbRef.current.onMove(g.dx);
      },
      onPanResponderRelease: () => {
        if (activeRef.current) {
          activeRef.current = false;
          cbRef.current.onEnd();
        }
      },
      onPanResponderTerminate: () => {
        if (activeRef.current) {
          activeRef.current = false;
          cbRef.current.onEnd();
        }
      },
    }),
  ).current;

  const dragging = dragIndex === index;
  // Where this tile rests while another is dragged: tiles between the picked-up
  // slot and the hover slot shift by one to open the gap.
  let base = index * slot;
  if (dragIndex != null && hoverIndex != null && !dragging) {
    if (dragIndex < hoverIndex && index > dragIndex && index <= hoverIndex) base -= slot;
    else if (dragIndex > hoverIndex && index >= hoverIndex && index < dragIndex) base += slot;
  }
  const pos = dragging
    ? {
        left: dragIndex * slot,
        transform: [{ translateX: dragX }, { scale: DRAG_SCALE }],
        zIndex: 20,
        elevation: 6,
      }
    : { left: base, zIndex: 1 };

  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, width: slot, height, alignItems: 'center', justifyContent: 'center' },
        pos,
      ]}
      {...pan.panHandlers}
    >
      {children}
    </Animated.View>
  );
}
