// The Tides & Bite planner sheet: pick a day, tap an hour on the chart, and
// see that moment's weather next to the NOAA tide curve and bite bars — with
// the day's peak hours highlighted. Rendered as a floating bottom sheet (NOT
// a Modal) so the map above it stays fully interactive; the host scrolls the
// map into view when it opens. A grab handle above the title lets the angler
// drag the sheet shorter/taller (it locks where they leave it).
import { useEffect, useRef, useState } from 'react';
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
import type { Conditions, Strategy } from '@/types';
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

function MiniStat({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.mini}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
      {hint ? <Text style={[styles.miniHint, warn && styles.miniHintWarn]}>{hint}</Text> : null}
    </View>
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
  // Dragged sheet height; null = fit the content. Locks where the drag ends
  // and survives close/reopen, so the angler sets it once.
  const [sheetH, setSheetH] = useState<number | null>(null);
  const sheetHRef = useRef<number | null>(null);
  const naturalH = useRef(0); // last laid-out height, the drag baseline
  const dragBase = useRef(0);

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
    }),
  ).current;

  // Every open starts at the default (content-fit) height — never the height
  // it was dragged to last time.
  useEffect(() => {
    if (visible) {
      sheetHRef.current = null;
      setSheetH(null);
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

  let chart = null;
  if (heights && heights.length >= 2 && tide) {
    const values = heights.map((p) => p.heightFt);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const pad = Math.max(0.3, (rawMax - rawMin) * 0.15);
    const min = rawMin - pad;
    const max = rawMax + pad;
    const x = (hour: number) => M.left + (hour / 23) * IW;
    const y = (v: number) => M.top + (1 - (v - min) / (max - min)) * IH;

    const pts = heights
      .map((p) => ({ hr: hourOf(p.time.replace(' ', 'T')), v: p.heightFt }))
      .filter((p) => !Number.isNaN(p.hr))
      .map((p) => ({ x: x(p.hr), y: y(p.v) }));
    const curve = smoothPath(pts);
    const area = `${curve} L ${M.left + IW} ${M.top + IH} L ${M.left} ${M.top + IH} Z`;

    const isToday = day.date === localDateStr(new Date());
    const now = new Date();
    const nowX = x(now.getHours() + now.getMinutes() / 60);

    chart = (
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

        {/* Tide curve + fill. */}
        <Path d={area} fill={colors.water} opacity={0.16} />
        <Path d={curve} stroke={colors.water} strokeWidth={2.5} fill="none" />

        {/* High/low markers with time + height. */}
        {tide.events.map((e, i) => {
          const hr = hourOf(e.time.replace(' ', 'T'));
          if (Number.isNaN(hr)) return null;
          const ex = x(hr + Number(e.time.slice(14, 16) || 0) / 60);
          const ey = y(e.heightFt);
          return (
            <SvgText key={`e${i}`} x={Math.min(Math.max(ex, 26), W - 26)} y={ey - 9} fontSize={11} fontWeight="700" fill={colors.text} textAnchor="middle">
              {`${e.type === 'high' ? 'H' : 'L'} ${e.heightFt}ft · ${fmtEventTime(e.time)}`}
            </SvgText>
          );
        })}
        {tide.events.map((e, i) => {
          const hr = hourOf(e.time.replace(' ', 'T'));
          if (Number.isNaN(hr)) return null;
          const ex = x(hr + Number(e.time.slice(14, 16) || 0) / 60);
          return <Circle key={`c${i}`} cx={ex} cy={y(e.heightFt)} r={3.5} fill={colors.water} stroke={colors.card} strokeWidth={1.5} />;
        })}

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
    );
  }

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
        {/* Drag handle: pull down for more map, up for more graph. */}
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
            <View style={styles.miniRow}>
              <MiniStat label="Air" value={`${hourWeather.airTempF}°F`} />
              <MiniStat
                label="Rain"
                value={`${hourWeather.precipChancePct}%`}
                hint={hourWeather.thunder ? '⚡ storms' : undefined}
                warn
              />
              <MiniStat
                label="Wind"
                value={`${hourWeather.windMph} mph`}
                hint={hourWeather.windDirectionLabel}
              />
              <MiniStat
                label="Pressure"
                value={`${hourWeather.pressureInHg}`}
                hint={`${TREND_ARROW[hourWeather.pressureTrend] ?? '·'} ${hourWeather.pressureTrend}`}
              />
              <MiniStat label="Sky" value={`${hourWeather.cloudCoverPct}%`} hint="cloud" />
              {selTide ? (
                <MiniStat
                  label="Tide"
                  value={TIDE_SHORT[selTide.state] ?? '—'}
                  hint={
                    selTide.nextEvent
                      ? `${selTide.nextEvent.type} ${fmtEventTime(selTide.nextEvent.time)}`
                      : undefined
                  }
                />
              ) : null}
            </View>

            {!tide ? (
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
              <View style={[styles.swatch, { backgroundColor: colors.water }]} />
              <Text style={styles.legendText}>Tide ft</Text>
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
  dayRow: { gap: spacing.xs + 2, paddingVertical: 2 },
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
  mini: { width: '16.6%', minWidth: 54, marginBottom: spacing.xs },
  miniValue: { color: c.text, fontSize: 14, fontWeight: '800' },
  miniLabel: { color: c.textMuted, fontSize: 11, marginTop: 1 },
  miniHint: { color: c.accent, fontSize: 10, marginTop: 1 },
  miniHintWarn: { color: c.warn },
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
