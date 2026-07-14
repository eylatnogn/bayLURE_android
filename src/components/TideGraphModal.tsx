// The Tides & Bite planner sheet: pick a day, tap an hour on the chart, and
// see that moment's weather next to the NOAA tide curve and bite bars — with
// the day's peak hours highlighted. Rendered as a floating bottom sheet (NOT
// a Modal) so the map above it stays fully interactive; the host scrolls the
// map into view when it opens. A grab handle above the title lets the angler
// drag the sheet shorter/taller (it locks where they leave it).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { Conditions, Strategy, WeatherConditions } from '@/types';
import { fetchTideHeights, tideAt, type TideHeightPoint } from '@/api/tides';
import { hourOf, localDateStr } from '@/utils/dates';
import { makeStyles, pressedStyle, radius, scoreColor, spacing, useTheme } from '@/theme';

export interface TideGraphDay {
  label: string;
  num: string;
  score: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** The full analyzed week (day 0 = today). */
  forecast: Conditions[];
  /** Strategies aligned with `forecast`. */
  strategies: Strategy[];
  /** Day chips (label/date/score), aligned with `forecast`. */
  days: TideGraphDay[];
  /** Selected day — SHARED with the Plan tab so the map wind overlay tracks it. */
  selectedDay: number;
  onSelectDay: (day: number) => void;
  /** Selected hour (null = whole-day). Shared so the map wind follows the hour. */
  selectedHour: number | null;
  onSelectHour: (hour: number | null) => void;
}

// Chart geometry (SVG viewBox units; rendered responsive via aspectRatio).
// Kept short on purpose so the map above the sheet gets its full height.
const W = 360;
const H = 190;
const M = { top: 24, right: 10, bottom: 30, left: 10 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
/** Bite bars rise from the axis up to this many px. */
const BAR_MAX = 40;
/** Hours scoring at least this get a fish marker. */
const PRIME = 65;
/** How short/tall the sheet can be dragged. */
const MIN_SHEET_H = 150;
/** Flick-to-dismiss: release faster than this (px/ms) AND... */
const DISMISS_VELOCITY = 0.85;
/** ...having travelled at least this far (px) closes the sheet. */
const DISMISS_DISTANCE = 70;

/** Catmull-Rom → cubic bezier path through the points (smooth tide curve). */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function fmtEventTime(noaaTime: string): string {
  const hm = noaaTime.split(' ')[1] ?? '';
  const [hStr, m] = hm.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return hm;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m}${h < 12 ? 'a' : 'p'}`;
}

function hr12(hr: number): string {
  return hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;
}

const TREND_ARROW: Record<string, string> = {
  rising: '↑',
  falling: '↓',
  steady: '→',
  unknown: '·',
};

const TIDE_SHORT: Record<string, string> = {
  incoming: 'In',
  outgoing: 'Out',
  slack: 'Slack',
  unknown: '—',
};

// Forecast metrics the chart can plot instead of the tide curve — tap a stat
// tile to switch, tap Tide (or the revert button) to come back.
type MetricKey = 'air' | 'rain' | 'wind' | 'pressure' | 'sky';
interface MetricCfg {
  /** Legend/heading text, e.g. "Rain %". */
  legend: string;
  /** Unit suffix for the high/low callouts. */
  unit: string;
  /** Min y-axis padding when the day's values are nearly flat. */
  pad: number;
  /** Fixed axis range (percent metrics), instead of fitting the data. */
  domain?: [number, number];
  decimals?: number;
  get: (w: WeatherConditions) => number;
}
const METRICS: Record<MetricKey, MetricCfg> = {
  air: { legend: 'Air °F', unit: '°F', pad: 2, get: (w) => w.airTempF },
  rain: { legend: 'Rain %', unit: '%', pad: 5, domain: [0, 100], get: (w) => w.precipChancePct },
  wind: { legend: 'Wind mph', unit: ' mph', pad: 2, get: (w) => w.windMph },
  pressure: { legend: 'Pressure inHg', unit: ' inHg', pad: 0.05, decimals: 2, get: (w) => w.pressureInHg },
  sky: { legend: 'Cloud %', unit: '%', pad: 5, domain: [0, 100], get: (w) => w.cloudCoverPct },
};

function MiniStat({
  label,
  value,
  hint,
  warn,
  active,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
  active?: boolean;
  onPress?: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.mini, active && styles.miniActive, pressed && onPress ? pressedStyle : null]}
    >
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
      {hint ? <Text style={[styles.miniHint, warn && styles.miniHintWarn]}>{hint}</Text> : null}
    </Pressable>
  );
}

export function TideGraphModal({
  visible,
  onClose,
  forecast,
  strategies,
  days,
  selectedDay,
  onSelectDay,
  selectedHour,
  onSelectHour,
}: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  // Aliases so the rest of the body reads the same as before.
  const selDay = selectedDay;
  const selHour = selectedHour;
  const [heights, setHeights] = useState<TideHeightPoint[] | null>(null);
  const [failed, setFailed] = useState(false);
  // What the chart's curve shows: the tide, or a tapped forecast metric.
  const [metric, setMetric] = useState<'tide' | MetricKey>('tide');
  // Dragged sheet height; null = fit the content. Locks where the drag ends
  // and survives close/reopen, so the angler sets it once.
  const [sheetH, setSheetH] = useState<number | null>(null);
  const sheetHRef = useRef<number | null>(null);
  const naturalH = useRef(0); // last laid-out height, the drag baseline
  const dragBase = useRef(0);

  // Drag-to-scrub across the chart: a horizontal drag maps the finger's page-X
  // to an hour and selects it live. We keep the chart's on-screen X + width
  // (measured on layout) so the pan handler can convert a touch into an hour.
  const chartRef = useRef<View>(null);
  const chartWRef = useRef(0);
  const chartXRef = useRef(0);
  const selectHourRef = useRef(onSelectHour);
  selectHourRef.current = onSelectHour;
  const pickHour = (pageX: number) => {
    const w = chartWRef.current;
    if (!w) return;
    const svgX = ((pageX - chartXRef.current) / w) * W;
    const hr = Math.max(0, Math.min(23, Math.round(((svgX - M.left) / IW) * 23)));
    selectHourRef.current(hr);
  };
  const hourPan = useRef(
    PanResponder.create({
      // Let plain taps fall through to the SVG hour targets; claim only a
      // clearly-horizontal drag so vertical scroll still works.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (_e, g) => pickHour(g.x0),
      onPanResponderMove: (_e, g) => pickHour(g.moveX),
    }),
  ).current;

  // Stable handle to the latest onClose so the once-created pan responder can
  // dismiss the sheet on a fast flick.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3,
      onPanResponderGrant: () => {
        dragBase.current = sheetHRef.current ?? naturalH.current;
      },
      onPanResponderMove: (_e, g) => {
        // Shrink-only: the default (content-fit) height is the ceiling —
        // dragging back up to it snaps the sheet back to auto-fit.
        const maxH = naturalH.current || Dimensions.get('window').height * 0.6;
        const h = Math.min(maxH, Math.max(MIN_SHEET_H, dragBase.current - g.dy));
        const next = h >= maxH - 2 ? null : h;
        sheetHRef.current = next;
        setSheetH(next);
      },
      onPanResponderRelease: (_e, g) => {
        // A fast, medium-to-long vertical flick reacts by direction: fling
        // DOWN to dismiss the sheet; fling UP to snap it back to the default
        // (content-fit) height. Both need real speed + distance so a slow
        // resize drag never triggers either.
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

  // Every open starts at the default (content-fit) height — never the height
  // it was dragged to last time.
  useEffect(() => {
    if (visible) {
      sheetHRef.current = null;
      setSheetH(null);
      setMetric('tide');
    }
  }, [visible]);

  // Without a Modal, Android's back button needs wiring by hand.
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const day = forecast[selDay];
  const strategy = strategies[selDay];
  const tide = day?.tide ?? null;

  useEffect(() => {
    if (!visible || !tide || !day) return;
    let alive = true;
    setFailed(false);
    setHeights(null);
    fetchTideHeights(tide.stationId, new Date(`${day.date}T12:00`))
      .then((pts) => {
        if (alive) setHeights(pts);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [visible, tide?.stationId, day?.date]);

  if (!day || !strategy) return null;

  // Weather for the current selection: a tapped hour, or the day overview.
  const hourWeather =
    selHour != null
      ? day.hourlyWeather.find((h) => hourOf(h.timeISO) === selHour) ?? day.weather
      : day.weather;
  const selTide =
    tide && selHour != null
      ? tideAt(tide.events, new Date(hourWeather.timeISO).getTime())
      : tide
        ? { state: tide.state, nextEvent: tide.nextEvent }
        : null;

  // Bite score per hour-of-day (bars + fish markers).
  const biteByHour = new Array<number | null>(24).fill(null);
  for (const h of strategy.hourly) {
    const hr = hourOf(h.timeISO);
    if (!Number.isNaN(hr)) biteByHour[hr] = h.score;
  }
  const scores = biteByHour.filter((s): s is number => s != null);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const isPeak = (s: number | null): s is number => s != null && s >= maxScore - 3 && s >= PRIME;
  const firstPeakHr = biteByHour.findIndex((s) => isPeak(s));

  // Chart geometry shared by every curve the chart can show.
  const x = (hour: number) => M.left + (hour / 23) * IW;
  const isToday = day.date === localDateStr(new Date());
  const now = new Date();
  const nowX = x(now.getHours() + now.getMinutes() / 60);
  const CHAR_HALF = 2.9; // ~half a glyph's width in viewBox units at fontSize 11
  const LABEL_GAP = 5; // min clear space between two labels
  const LINE_H = 12; // labels only clash if within this vertical band (~one line)

  // The curve layer: NOAA tide heights, or the tapped forecast metric.
  let curveLayer: ReactNode = null;
  let legendMain = { color: colors.water, label: 'Tide ft' };

  if (metric !== 'tide') {
    const cfg = METRICS[metric];
    const series = (day.hourlyWeather ?? [])
      .map((h) => ({ hr: hourOf(h.timeISO), v: cfg.get(h) }))
      .filter((p) => !Number.isNaN(p.hr) && typeof p.v === 'number' && !Number.isNaN(p.v))
      .sort((a, b) => a.hr - b.hr);
    if (series.length >= 2) {
      const vals = series.map((p) => p.v);
      let min: number;
      let max: number;
      if (cfg.domain) {
        [min, max] = cfg.domain;
      } else {
        const rawMin = Math.min(...vals);
        const rawMax = Math.max(...vals);
        const pad = Math.max(cfg.pad, (rawMax - rawMin) * 0.15);
        min = rawMin - pad;
        max = rawMax + pad;
      }
      const y = (v: number) => M.top + (1 - (v - min) / (max - min)) * IH;
      const pts = series.map((p) => ({ x: x(p.hr), y: y(p.v) }));
      const curve = smoothPath(pts);
      const area = `${curve} L ${x(series[series.length - 1]!.hr)} ${M.top + IH} L ${x(series[0]!.hr)} ${M.top + IH} Z`;
      // High/low callouts so the day's swing reads at a glance.
      let hiIdx = 0;
      let loIdx = 0;
      series.forEach((p, i) => {
        if (p.v > series[hiIdx]!.v) hiIdx = i;
        if (p.v < series[loIdx]!.v) loIdx = i;
      });
      const fmtV = (v: number) =>
        cfg.decimals != null ? v.toFixed(cfg.decimals) : String(Math.round(v));
      // Compact two-row callouts (value, then time) at a smaller size, placed
      // to dodge the fish/score markers riding above the bite bars — a single
      // long row at full size blended straight into them.
      const ROW_H = 11;
      const FISH_TOP = M.top + IH - BAR_MAX - 34; // score numbers' top edge
      const FISH_BOT = M.top + IH - BAR_MAX; // down to the bars
      const primeXs: number[] = [];
      biteByHour.forEach((s, hr) => {
        if (s != null && s >= PRIME) primeXs.push(x(hr));
      });
      const callouts: {
        row1: string;
        row2: string;
        cx: number;
        cy: number;
        halfW: number;
        dotX: number;
        dotY: number;
      }[] = [];
      [hiIdx, ...(loIdx !== hiIdx ? [loIdx] : [])].forEach((idx, k) => {
        const p = series[idx]!;
        const row1 = `${k === 0 ? 'High' : 'Low'} ${fmtV(p.v)}${cfg.unit}`;
        const row2 = hr12(p.hr);
        const halfW = Math.max(row1.length, row2.length) * 2.7;
        const cx = Math.min(Math.max(x(p.hr), halfW + 2), W - halfW - 2);
        const py = y(p.v);
        const hitsFish = (top: number, bot: number) =>
          bot > FISH_TOP &&
          top < FISH_BOT &&
          primeXs.some((px) => Math.abs(px - cx) < halfW + 8);
        const collides = (cy: number) =>
          hitsFish(cy - 9, cy + ROW_H + 2) ||
          callouts.some(
            (o) =>
              Math.abs(o.cx - cx) < o.halfW + halfW + 6 &&
              Math.abs(o.cy - cy) < ROW_H * 2 + 4,
          );
        // Try above the dot, higher above, below it, then the top edge.
        let cy = Math.min(Math.max(py - 21, 12), M.top + IH - ROW_H - 6);
        for (const cand of [py - 21, py - 44, py + 14, 22]) {
          const cl = Math.min(Math.max(cand, 12), M.top + IH - ROW_H - 6);
          if (!collides(cl)) {
            cy = cl;
            break;
          }
        }
        callouts.push({ row1, row2, cx, cy, halfW, dotX: x(p.hr), dotY: py });
      });
      const selPt = selHour != null ? series.find((p) => p.hr === selHour) : undefined;
      legendMain = { color: colors.accent, label: cfg.legend };
      curveLayer = (
        <>
          <Path d={area} fill={colors.accent} opacity={0.13} />
          <Path d={curve} stroke={colors.accent} strokeWidth={2.5} fill="none" />
          {callouts.map((co, i) => (
            <SvgText key={`mc${i}`} x={co.cx} y={co.cy} fontSize={10} fontWeight="700" fill={colors.text} textAnchor="middle">
              {co.row1}
            </SvgText>
          ))}
          {callouts.map((co, i) => (
            <SvgText key={`mt${i}`} x={co.cx} y={co.cy + 11} fontSize={10} fill={colors.textMuted} textAnchor="middle">
              {co.row2}
            </SvgText>
          ))}
          {callouts.map((co, i) => (
            <Circle key={`md${i}`} cx={co.dotX} cy={co.dotY} r={3.5} fill={colors.accent} stroke={colors.card} strokeWidth={1.5} />
          ))}
          {selPt ? (
            <Circle cx={x(selPt.hr)} cy={y(selPt.v)} r={4.5} fill="none" stroke={colors.accent} strokeWidth={2} />
          ) : null}
        </>
      );
    }
  } else if (heights && heights.length >= 2 && tide) {
    const values = heights.map((p) => p.heightFt);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max(0.3, (rawMax - rawMin) * 0.15);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const y = (v: number) => M.top + (1 - (v - min) / (max - min)) * IH;

    const pts = heights
      .map((p) => ({ hr: hourOf(p.time.replace(' ', 'T')), v: p.heightFt }))
      .filter((p) => !Number.isNaN(p.hr))
      .map((p) => ({ x: x(p.hr), y: y(p.v) }));
    const curve = smoothPath(pts);
    const area = `${curve} L ${M.left + IW} ${M.top + IH} L ${M.left} ${M.top + IH} Z`;

    // De-clutter the high/low labels. Each label is nearly half the chart wide,
    // so when extremes bunch up in time the labels overlap into an unreadable
    // smear. Place the most extreme events first (the true daily high & low read
    // first), then keep another label only if it clears the ones already placed;
    // the dropped events still keep their marker dot. Horizontal position is
    // clamped by the label's real width so the end labels aren't clipped.
    const meanH = values.reduce((a, b) => a + b, 0) / values.length;
    const tideLabels: { cx: number; cy: number; halfW: number; text: string }[] = [];
    const candidates = tide.events
      .map((e) => {
        const hr = hourOf(e.time.replace(' ', 'T'));
        if (Number.isNaN(hr)) return null;
        const exact = hr + Number(e.time.slice(14, 16) || 0) / 60;
        const text = `${e.type === 'high' ? 'H' : 'L'} ${e.heightFt}ft · ${fmtEventTime(e.time)}`;
        const halfW = text.length * CHAR_HALF;
        return {
          text,
          halfW,
          cx: Math.min(Math.max(x(exact), halfW + 2), W - halfW - 2),
          cy: y(e.heightFt) - 9,
          rank: Math.abs(e.heightFt - meanH),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.rank - a.rank);
    // Every extreme keeps its label. A label that would overlap an already
    // placed one (horizontally AND on the same line) tries other spots instead
    // of being dropped: above its dot, below it, then stacked line by line.
    const clashesAt = (cx: number, cy: number, halfW: number) =>
      tideLabels.some(
        (p) =>
          Math.abs(p.cx - cx) < p.halfW + halfW + LABEL_GAP &&
          Math.abs(p.cy - cy) < LINE_H,
      );
    for (const c of candidates) {
      const above = c.cy; // default spot: just above the marker dot
      const below = c.cy + 24; // just below the dot
      let placedY: number | null = null;
      for (let step = 0; step < 6 && placedY == null; step++) {
        for (const raw of [above - step * (LINE_H + 1), below + step * (LINE_H + 1)]) {
          const cy = Math.min(Math.max(raw, 12), M.top + IH - 4);
          if (!clashesAt(c.cx, cy, c.halfW)) {
            placedY = cy;
            break;
          }
        }
      }
      tideLabels.push({ cx: c.cx, cy: placedY ?? c.cy, halfW: c.halfW, text: c.text });
    }

    curveLayer = (
      <>
        {/* Tide curve + fill. */}
        <Path d={area} fill={colors.water} opacity={0.16} />
        <Path d={curve} stroke={colors.water} strokeWidth={2.5} fill="none" />

        {/* High/low markers with time + height (stacked so clustered
            extremes never overlap). */}
        {tideLabels.map((l, i) => (
          <SvgText key={`e${i}`} x={l.cx} y={l.cy} fontSize={11} fontWeight="700" fill={colors.text} textAnchor="middle">
            {l.text}
          </SvgText>
        ))}
        {tide.events.map((e, i) => {
          const hr = hourOf(e.time.replace(' ', 'T'));
          if (Number.isNaN(hr)) return null;
          const ex = x(hr + Number(e.time.slice(14, 16) || 0) / 60);
          return <Circle key={`c${i}`} cx={ex} cy={y(e.heightFt)} r={3.5} fill={colors.water} stroke={colors.card} strokeWidth={1.5} />;
        })}
      </>
    );
  }

  const chart =
    curveLayer == null ? null : (
      <View
        ref={chartRef}
        onLayout={() =>
          chartRef.current?.measureInWindow((px, _py, w) => {
            chartXRef.current = px;
            if (w) chartWRef.current = w;
          })
        }
        {...hourPan.panHandlers}
      >
      <Svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', aspectRatio: W / H }}>
        {/* Peak-hour highlight bands — the "go NOW" hours. */}
        {biteByHour.map((score, hr) =>
          isPeak(score) ? (
            <Rect
              key={`p${hr}`}
              x={x(hr) - IW / 24 / 2}
              y={M.top - 4}
              width={IW / 24}
              height={IH + 4}
              fill={colors.warn}
              opacity={0.14}
            />
          ) : null,
        )}

        {/* Selected-hour band. */}
        {selHour != null ? (
          <Rect
            x={x(selHour) - IW / 24 / 2}
            y={M.top - 4}
            width={IW / 24}
            height={IH + 4}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.5}
            rx={3}
          />
        ) : null}

        {/* Bite bars — the "when they're biting" layer. */}
        {biteByHour.map((score, hr) =>
          score == null ? null : (
            <Rect
              key={`b${hr}`}
              x={x(hr) - IW / 24 / 2 + 1.5}
              y={M.top + IH - Math.max(3, (score / 100) * BAR_MAX)}
              width={IW / 24 - 3}
              height={Math.max(3, (score / 100) * BAR_MAX)}
              rx={2}
              fill={scoreColor(score, colors)}
              opacity={isPeak(score) ? 0.95 : 0.5}
            />
          ),
        )}

        {/* Prime-hour markers, tiered: peak hours get a big fish + the score. */}
        {biteByHour.map((score, hr) => {
          if (score == null || score < PRIME) return null;
          const peak = isPeak(score);
          return (
            <SvgText
              key={`f${hr}`}
              x={x(hr)}
              y={M.top + IH - BAR_MAX - (peak ? 8 : 5)}
              fontSize={peak ? 14 : 9}
              opacity={peak ? 1 : 0.55}
              textAnchor="middle"
            >
              🐟
            </SvgText>
          );
        })}
        {biteByHour.map((score, hr) =>
          isPeak(score) ? (
            <SvgText
              key={`s${hr}`}
              x={x(hr)}
              y={M.top + IH - BAR_MAX - 21}
              fontSize={11}
              fontWeight="800"
              fill={colors.warn}
              textAnchor="middle"
            >
              {score}
            </SvgText>
          ) : null,
        )}

        {/* Peak callout pill. */}
        {firstPeakHr >= 0 ? (
          <SvgText
            x={Math.min(Math.max(x(firstPeakHr), 58), W - 58)}
            y={13}
            fontSize={13}
            fontWeight="800"
            fill={colors.warn}
            textAnchor="middle"
          >
            {`★ Peak bite · ${hr12(firstPeakHr)}`}
          </SvgText>
        ) : null}

        {/* The active curve: tide heights, or the tapped forecast metric. */}
        {curveLayer}

        {/* Now cursor (today only). */}
        {isToday ? (
          <Line x1={nowX} y1={M.top - 6} x2={nowX} y2={M.top + IH} stroke={colors.warn} strokeWidth={1.5} strokeDasharray="4 3" />
        ) : null}

        {/* Hour axis. */}
        <Line x1={M.left} y1={M.top + IH} x2={M.left + IW} y2={M.top + IH} stroke={colors.cardBorder} strokeWidth={1} />
        {[0, 4, 8, 12, 16, 20].map((hr) => (
          <SvgText key={`h${hr}`} x={x(hr)} y={H - 12} fontSize={11} fill={colors.textMuted} textAnchor="middle">
            {hr === 0 ? '12a' : hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr - 12}p`}
          </SvgText>
        ))}

        {/* Tap targets — last, so they sit on top and catch the touches. */}
        {biteByHour.map((score, hr) =>
          score == null ? null : (
            <Rect
              key={`t${hr}`}
              x={x(hr) - IW / 24 / 2}
              y={M.top - 6}
              width={IW / 24}
              height={IH + 6}
              fill="transparent"
              onPress={() => onSelectHour(selHour === hr ? null : hr)}
            />
          ),
        )}
      </Svg>
      </View>
    );

  if (!visible) return null;

  return (
    // A floating sheet, not a Modal: everything above it (the map!) stays live.
    <View style={styles.overlay} pointerEvents="box-none">
      <View
        style={[styles.sheet, sheetH != null && { height: sheetH }]}
        onLayout={(e) => {
          // Only record the content-fit height while no custom height is
          // applied — otherwise the drag ceiling would shrink to wherever
          // the sheet was last dragged.
          if (sheetHRef.current == null) {
            naturalH.current = e.nativeEvent.layout.height;
          }
        }}
      >
        {/* Drag handle: pull down for more map, up for more graph. Fling it
            down quickly to dismiss, or up quickly to snap back to full height. */}
        <View style={styles.grabRow} {...pan.panHandlers}>
          <View style={styles.grab} />
        </View>
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Tides & Bite</Text>
                {tide ? (
                  <Text style={styles.subtitle}>
                    {tide.stationName} ({tide.stationDistanceMi} mi)
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
                <Feather name="x" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Day picker. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
              {days.map((d, i) => {
                const active = i === selDay;
                return (
                  <Pressable
                    key={i}
                    onPress={() => {
                      onSelectDay(i);
                      onSelectHour(null);
                    }}
                    style={({ pressed }) => [styles.day, active && styles.dayActive, pressed && pressedStyle]}
                  >
                    <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{d.label}</Text>
                    <Text style={[styles.dayNum, active && styles.dayLabelActive]}>{d.num}</Text>
                    <View style={[styles.dayPill, { backgroundColor: scoreColor(d.score) }]}>
                      <Text style={styles.dayPillText}>{d.score}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Weather for the selected day/hour. */}
            <View style={styles.condHead}>
              <Text style={styles.condTitle}>
                {days[selDay]?.label ?? ''} · {selHour != null ? hr12(selHour) : 'all day'}
              </Text>
              {selHour != null ? (
                <Pressable onPress={() => onSelectHour(null)} hitSlop={8}>
                  <Text style={styles.allday}>All day</Text>
                </Pressable>
              ) : (
                <Text style={styles.tapHint}>tap the chart for an hour</Text>
              )}
            </View>
            {/* Tap a stat to plot that metric through the day; Tide reverts. */}
            <View style={styles.miniRow}>
              <MiniStat
                label="Air"
                value={`${hourWeather.airTempF}°F`}
                active={metric === 'air'}
                onPress={() => setMetric('air')}
              />
              <MiniStat
                label="Rain"
                value={`${hourWeather.precipChancePct}%`}
                hint={hourWeather.thunder ? '⚡ storms' : undefined}
                warn
                active={metric === 'rain'}
                onPress={() => setMetric('rain')}
              />
              <MiniStat
                label="Wind"
                value={`${hourWeather.windMph} mph`}
                hint={hourWeather.windDirectionLabel}
                active={metric === 'wind'}
                onPress={() => setMetric('wind')}
              />
              <MiniStat
                label="Pressure"
                value={`${hourWeather.pressureInHg}`}
                hint={`${TREND_ARROW[hourWeather.pressureTrend] ?? '·'} ${hourWeather.pressureTrend}`}
                active={metric === 'pressure'}
                onPress={() => setMetric('pressure')}
              />
              <MiniStat
                label="Sky"
                value={`${hourWeather.cloudCoverPct}%`}
                hint="cloud"
                active={metric === 'sky'}
                onPress={() => setMetric('sky')}
              />
              {selTide ? (
                <MiniStat
                  label="Tide"
                  value={TIDE_SHORT[selTide.state] ?? '—'}
                  hint={
                    selTide.nextEvent
                      ? `${selTide.nextEvent.type} ${fmtEventTime(selTide.nextEvent.time)}`
                      : undefined
                  }
                  active={metric === 'tide'}
                  onPress={() => setMetric('tide')}
                />
              ) : null}
            </View>

            {metric !== 'tide' ? (
              <View style={styles.metricBar}>
                <Text style={styles.metricBarText}>
                  {METRICS[metric].legend} through the day
                </Text>
                <Pressable
                  onPress={() => setMetric('tide')}
                  hitSlop={6}
                  style={({ pressed }) => [styles.revertBtn, pressed && pressedStyle]}
                >
                  <Feather name="corner-up-left" size={13} color={colors.onAccent} />
                  <Text style={styles.revertText}>Tide chart</Text>
                </Pressable>
              </View>
            ) : null}

            {metric !== 'tide' ? (
              chart ?? (
                <Text style={styles.error}>No hourly forecast data for this day.</Text>
              )
            ) : !tide ? (
              <Text style={styles.error}>No tide station in range for this day.</Text>
            ) : failed ? (
              <Text style={styles.error}>
                Couldn't load hourly tide heights from NOAA. Check your connection
                and try again.
              </Text>
            ) : !heights ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl * 2 }} />
            ) : heights.length < 2 ? (
              <Text style={styles.error}>No hourly tide data for this day at this station.</Text>
            ) : (
              chart
            )}

            <View style={styles.legend}>
              <View style={[styles.swatch, { backgroundColor: legendMain.color }]} />
              <Text style={styles.legendText}>{legendMain.label}</Text>
              <View style={[styles.swatch, { backgroundColor: colors.good, opacity: 0.6 }]} />
              <Text style={styles.legendText}>Bite</Text>
              <Text style={styles.legendText}>🐟 good</Text>
              <Text style={[styles.legendText, { color: colors.warn, fontWeight: '700' }]}>
                ★ peak
              </Text>
            </View>
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, t) => ({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  sheet: {
    width: '100%',
    maxWidth: 800,
    // A shade darker than the page/cards so the sheet reads as its own layer.
    backgroundColor: t.mode === 'dark' ? '#0a120d' : '#dfe8d9',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: t.mode === 'dark' ? '#33443a' : c.cardBorder,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    elevation: 14,
    ...t.shadow.card,
  },
  grabRow: {
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  grab: {
    width: 52,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: c.textMuted,
    opacity: 0.6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: c.text,
  },
  subtitle: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 1,
  },
  close: {
    padding: spacing.xs,
  },
  dayRow: { gap: spacing.xs + 2, paddingVertical: 2, flexGrow: 1, justifyContent: 'center' },
  day: {
    width: 50,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: c.bgElevated,
    borderWidth: 1,
    borderColor: c.cardBorder,
    gap: 3,
  },
  dayActive: { backgroundColor: c.accentDim, borderColor: c.accent },
  dayLabel: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
  dayLabelActive: { color: c.text },
  dayNum: { color: c.textMuted, fontSize: 12 },
  dayPill: {
    minWidth: 28,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
    alignItems: 'center',
  },
  dayPillText: { color: '#0e1f12', fontSize: 13, fontWeight: '900' },
  condHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  condTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '800',
  },
  allday: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  tapHint: {
    color: c.textMuted,
    fontSize: 12,
  },
  miniRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  mini: {
    width: '16.6%',
    minWidth: 54,
    marginBottom: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  miniActive: { backgroundColor: c.accentDim, borderColor: c.accent },
  miniValue: { color: c.text, fontSize: 14, fontWeight: '800' },
  miniLabel: { color: c.textMuted, fontSize: 11, marginTop: 1 },
  miniHint: { color: c.accent, fontSize: 10, marginTop: 1 },
  miniHintWarn: { color: c.warn },
  // Heading + revert button shown while a forecast metric is plotted.
  metricBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  metricBarText: { color: c.text, fontSize: 13, fontWeight: '700' },
  revertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.accent,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
  },
  revertText: { color: c.onAccent, fontSize: 12.5, fontWeight: '800' },
  error: {
    color: c.errorText,
    backgroundColor: c.errorBg,
    borderColor: c.errorBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 13,
    marginVertical: spacing.md,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  swatch: {
    width: 12,
    height: 5,
    borderRadius: 2,
  },
  legendText: {
    color: c.textMuted,
    fontSize: 12,
    marginRight: spacing.xs,
  },
}));
