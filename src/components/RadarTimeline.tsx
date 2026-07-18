import { useRef } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

/** What the host tracks about a map instance's radar loop. */
export interface RadarTimelineState {
  /** Frame labels straight from the map (e.g. "Radar · +45 min forecast"). */
  frames: string[];
  idx: number;
  /** Index of the "now" frame — the observed/forecast seam, marked on the track. */
  nowIdx: number;
  playing: boolean;
}

/** Commands the host can send into a map instance's radar loop. */
export interface RadarControl {
  scrub: (idx: number) => void;
  play: () => void;
}

interface Props {
  frames: string[];
  index: number;
  nowIndex: number;
  playing: boolean;
  onScrub: (index: number) => void;
  onPlayPause: () => void;
}

/**
 * Draggable radar timeline, drawn OUTSIDE the map (below the inline map and
 * along the bottom of the full-screen view). Drag or tap the track to scrub
 * the radar loop to a moment — that pauses the animation on the chosen frame;
 * the play button resumes it. A small tick marks "now", the seam between
 * observed radar (left) and the HRRR forecast (right).
 */
export function RadarTimeline({ frames, index, nowIndex, playing, onScrub, onPlayPause }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const trackW = useRef(0);
  const framesLen = useRef(frames.length);
  framesLen.current = frames.length;
  const scrubRef = useRef(onScrub);
  scrubRef.current = onScrub;

  const measure = () => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackX.current = x;
      if (w) trackW.current = w;
    });
  };
  const pick = (pageX: number) => {
    const w = trackW.current;
    if (!w || framesLen.current < 2) return;
    const t = Math.max(0, Math.min(1, (pageX - trackX.current) / w));
    scrubRef.current(Math.round(t * (framesLen.current - 1)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_e, g) => {
        measure();
        pick(g.x0);
      },
      onPanResponderMove: (_e, g) => pick(g.moveX),
    }),
  ).current;

  const pct = frames.length > 1 ? (index / (frames.length - 1)) * 100 : 0;
  const nowPct =
    frames.length > 1 && nowIndex >= 0 ? (nowIndex / (frames.length - 1)) * 100 : null;
  const label = (frames[index] ?? '').replace(/^Radar · /, '');

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onPlayPause}
        hitSlop={10}
        style={({ pressed }) => [styles.play, pressed && pressedStyle]}
        accessibilityLabel={playing ? 'Pause the radar loop' : 'Play the radar loop'}
      >
        <Feather name={playing ? 'pause' : 'play'} size={16} color={colors.accent} />
      </Pressable>
      <View style={styles.trackCol}>
        {/* Generous vertical padding = a finger-sized drag target. */}
        <View ref={trackRef} style={styles.trackPad} onLayout={measure} {...pan.panHandlers}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
            {nowPct != null ? <View style={[styles.nowTick, { left: `${nowPct}%` }]} /> : null}
            <View style={[styles.thumb, { left: `${pct}%` }]} />
          </View>
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.cardBorder,
  },
  play: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentDim,
  },
  trackCol: { flex: 1 },
  trackPad: {
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: c.cardBorder,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  nowTick: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: c.textMuted,
  },
  thumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.card,
  },
  label: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 1,
  },
}));
