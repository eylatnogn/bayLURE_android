// The tide + bite graph: hourly NOAA water heights drawn as a curve over the
// day's hourly bite scores, with high/low markers, fish icons on prime hours,
// and a "now" cursor. Opened from the Forecast card (saltwater spots only).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { HourBite, TideConditions } from '@/types';
import { fetchTideHeights, type TideHeightPoint } from '@/api/tides';
import { hourOf, localDateStr } from '@/utils/dates';
import { fonts, makeStyles, radius, scoreColor, spacing, useTheme } from '@/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  tide: TideConditions;
  /** The selected day's hourly bite scores from the strategy. */
  hourly: HourBite[];
  /** "Today" / "Thu" — for the header. */
  dayLabel: string;
  /** The day being graphed, local YYYY-MM-DD. */
  date: string;
}

// Chart geometry (SVG viewBox units; rendered responsive via aspectRatio).
const W = 360;
const H = 205;
const M = { top: 24, right: 10, bottom: 30, left: 10 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;
/** Bite bars rise from the axis up to this many px. */
const BAR_MAX = 52;
/** Hours scoring at least this get a fish marker. */
const PRIME = 65;

/** Catmull-Rom → cubic bezier path through the points (smooth tide curve). */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
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

export function TideGraphModal({ visible, onClose, tide, hourly, dayLabel, date }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [heights, setHeights] = useState<TideHeightPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setFailed(false);
    setHeights(null);
    fetchTideHeights(tide.stationId, new Date(`${date}T12:00`))
      .then((pts) => {
        if (alive) setHeights(pts);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [visible, tide.stationId, date]);

  // Bite score per hour-of-day (bars + fish markers).
  const biteByHour = new Array<number | null>(24).fill(null);
  for (const h of hourly) {
    const hr = hourOf(h.timeISO);
    if (!Number.isNaN(hr)) biteByHour[hr] = h.score;
  }

  // The day's peak: the best-scoring hour(s), highlighted so "when exactly?"
  // has a one-glance answer. Hours within 3 points of the max count as peak.
  const scores = biteByHour.filter((s): s is number => s != null);
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const isPeak = (s: number | null): s is number => s != null && s >= maxScore - 3 && s >= PRIME;
  const firstPeakHr = biteByHour.findIndex((s) => isPeak(s));

  const hr12 = (hr: number) =>
    hr === 0 ? '12 AM' : hr < 12 ? `${hr} AM` : hr === 12 ? '12 PM' : `${hr - 12} PM`;

  let chart = null;
  if (heights && heights.length >= 2) {
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

    const isToday = date === localDateStr(new Date());
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

        {/* Prime-hour markers, tiered: peak hours get a big fish + the score,
            other good hours a smaller, dimmer one. */}
        {biteByHour.map((score, hr) => {
          if (score == null || score < PRIME) return null;
          const peak = isPeak(score);
          return (
            <SvgText
              key={`f${hr}`}
              x={x(hr)}
              y={M.top + IH - BAR_MAX - (peak ? 8 : 5)}
              fontSize={peak ? 13 : 8}
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
              y={M.top + IH - BAR_MAX - 22}
              fontSize={9}
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
            x={Math.min(Math.max(x(firstPeakHr), 44), W - 44)}
            y={12}
            fontSize={11}
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
            <SvgText key={`e${i}`} x={Math.min(Math.max(ex, 26), W - 26)} y={ey - 8} fontSize={9} fontWeight="700" fill={colors.text} textAnchor="middle">
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
          <SvgText key={`h${hr}`} x={x(hr)} y={H - 12} fontSize={9} fill={colors.textMuted} textAnchor="middle">
            {hr === 0 ? '12a' : hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr - 12}p`}
          </SvgText>
        ))}
      </Svg>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, width > 500 && styles.sheetWide]}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Tides & Bite</Text>
              <Text style={styles.subtitle}>
                {dayLabel} · {tide.stationName} ({tide.stationDistanceMi} mi)
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {failed ? (
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
            <Text style={styles.legendText}>Tide height (ft, MLLW)</Text>
            <View style={[styles.swatch, { backgroundColor: colors.good, opacity: 0.6 }]} />
            <Text style={styles.legendText}>Bite score</Text>
            <Text style={styles.legendText}>🐟 good hours</Text>
            <Text style={[styles.legendText, { color: colors.warn, fontWeight: '700' }]}>
              ★ highlighted = peak
            </Text>
          </View>
          <Text style={styles.finePrint}>
            NOAA tide predictions · bite graded hourly from the day's forecast.
            Moving water near highs and lows usually fishes best.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, t) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 12, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    ...t.shadow.card,
  },
  sheetWide: {
    alignSelf: 'center',
    width: 520,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: c.text,
  },
  subtitle: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  close: {
    padding: spacing.xs,
  },
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
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  swatch: {
    width: 12,
    height: 5,
    borderRadius: 2,
  },
  legendText: {
    color: c.textMuted,
    fontSize: 11,
    marginRight: spacing.sm,
  },
  finePrint: {
    color: c.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: spacing.sm,
  },
}));
