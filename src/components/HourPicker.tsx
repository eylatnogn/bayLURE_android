import { useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { makeStyles, radius } from '@/theme';

const ITEM_W = 52;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface HourItem {
  label: string;
  /** The hour index, or null for "All day". */
  hour: number | null;
}

interface Props {
  items: HourItem[];
  value: number | null;
  onChange: (hour: number | null) => void;
}

/**
 * A horizontal scroll picker for the hour: scroll and the option that lands
 * under the centre highlight becomes the selection (committed when the scroll
 * settles) — no separate tap needed, though tapping an option still selects it.
 */
export function HourPicker({ items, value, onChange }: Props) {
  const styles = useStyles();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const sidePad = width > 0 ? (width - ITEM_W) / 2 : 0;
  const valueIdx = Math.max(
    0,
    items.findIndex((it) => it.hour === value),
  );
  const [centerIdx, setCenterIdx] = useState(valueIdx);
  const lastX = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Centre the current value when the layout settles or the value changes from
  // outside (the graph sheet, or a day switch resetting to "All day").
  useEffect(() => {
    if (width > 0) {
      scrollRef.current?.scrollTo({ x: valueIdx * ITEM_W, animated: false });
      setCenterIdx(valueIdx);
    }
  }, [valueIdx, width]);

  useEffect(() => () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const idxFromOffset = (x: number) => clamp(Math.round(x / ITEM_W), 0, items.length - 1);

  // Snap to and commit the option nearest the current offset.
  const commitAt = (x: number) => {
    const idx = idxFromOffset(x);
    if (Math.abs(x - idx * ITEM_W) > 2) {
      scrollRef.current?.scrollTo({ x: idx * ITEM_W, animated: true });
    }
    setCenterIdx(idx);
    const it = items[idx];
    if (it && it.hour !== value) onChange(it.hour);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    lastX.current = x;
    const idx = idxFromOffset(x);
    if (idx !== centerIdx) setCenterIdx(idx);
    // Commit once scrolling pauses. This is the cross-platform settle signal —
    // native fires onMomentumScrollEnd too, but a web wheel-scroll only emits
    // scroll events, so the idle timer is what lands the selection there.
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => commitAt(lastX.current), 140);
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    commitAt(e.nativeEvent.contentOffset.x);
  };

  const selectIdx = (idx: number) => {
    scrollRef.current?.scrollTo({ x: idx * ITEM_W, animated: true });
    setCenterIdx(idx);
    const it = items[idx];
    if (it && it.hour !== value) onChange(it.hour);
  };

  return (
    // Styled like a vintage car-radio tuner: a cream dial face with the hours
    // as the frequency scale, tick marks on a baseline, and a fixed red needle
    // in the middle — scroll and the hours glide under the needle.
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_W}
        disableIntervalMomentum
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: sidePad }}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
      >
        {items.map((it, i) => (
          <Pressable
            key={i}
            onPress={() => selectIdx(i)}
            style={[styles.item, { width: ITEM_W }]}
          >
            <Text
              style={[styles.itemText, i === centerIdx && styles.itemTextActive]}
              numberOfLines={1}
            >
              {it.label}
            </Text>
            <View style={styles.tick} />
          </Pressable>
        ))}
      </ScrollView>
      {/* Printed-on-the-glass details: scale baseline, needle, brand mark. */}
      <View pointerEvents="none" style={styles.baseline} />
      <View pointerEvents="none" style={[styles.needle, { left: sidePad + ITEM_W / 2 - 1 }]} />
      <Text pointerEvents="none" style={styles.brand}>
        bayLURE
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  // The dial face — same surface as the Tides & Bite sheet, so the tuner reads
  // as a piece of that graph pulled onto the main page.
  wrap: {
    height: 52,
    justifyContent: 'center',
    backgroundColor: t.mode === 'dark' ? '#0a120d' : '#dfe8d9',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: t.mode === 'dark' ? '#33443a' : c.cardBorder,
    overflow: 'hidden',
  },
  item: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingBottom: 10,
  },
  itemText: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  itemTextActive: { color: c.accent, fontSize: 13, fontWeight: '800' },
  // Scale graduation under each hour, sitting on the baseline (bite-bar green,
  // echoing the graph's hour bars).
  tick: {
    position: 'absolute',
    bottom: 9,
    width: 2,
    height: 6,
    backgroundColor: c.accent,
    opacity: 0.55,
  },
  baseline: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 9,
    height: 1,
    backgroundColor: c.textMuted,
    opacity: 0.4,
  },
  // The tuning needle, fixed at the dial's centre — tide-curve teal, like the
  // graph's tide line.
  needle: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: c.water,
  },
  brand: {
    position: 'absolute',
    right: 8,
    bottom: 1,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: c.textMuted,
    opacity: 0.6,
  },
}));
