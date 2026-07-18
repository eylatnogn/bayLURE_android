import type { Conditions, LurePick, Strategy } from '@/types';
import { LURES, type LureEntry, type Presentation } from '@/engine/lureDatabase';
import { speciesLabel, speciesTip } from '@/engine/species';
import {
  aggressivePenalty,
  buildPressurePlaybook,
  isPressured,
  pressureBitePenalty,
  pressureFriendlyBonus,
} from '@/engine/pressure';
import { buildClarityPlaybook, clarityLureAdjust } from '@/engine/clarity';
import { buildBehavior } from '@/engine/behavior';
import { depthLureAdjust } from '@/engine/depth';
import { gearFor } from '@/engine/gear';
import { tideStateAt } from '@/api/tides';
import { hourLabel, hourOf } from '@/utils/dates';
import type { HourBite, BestWindow } from '@/types';

/**
 * Build a complete fishing strategy from gathered conditions using a
 * transparent rule-based model. Every number here encodes a widely-held
 * angling heuristic; the goal is explainable, not magic.
 */
export function buildStrategy(c: Conditions): Strategy {
  const { factors } = scoreBite(c);
  const hourly = buildHourly(c);
  // The all-day bite score is the AVERAGE across the day's hours, not just the
  // midday snapshot — one reading at noon isn't representative of the whole day.
  // (Falls back to the snapshot if there's no hourly data.)
  const biteScore = hourly.length
    ? clamp(Math.round(hourly.reduce((sum, h) => sum + h.score, 0) / hourly.length), 1, 99)
    : scoreBite(c).score;
  // Pressured water nudges the approach toward finesse: one notch for moderate,
  // straight to finesse for high.
  let mood = biteMood(biteScore);
  if (c.pressureLevel === 'moderate') mood = downshift(mood);
  else if (c.pressureLevel === 'high') mood = 'finesse';

  const picks = rankPicks(c, mood);
  const summary = buildSummary(c, biteScore, mood);

  for (const sp of c.species) {
    const tip = speciesTip(sp);
    if (tip) factors.push(`Targeting ${speciesLabel(sp)}: ${tip}`);
  }

  return {
    biteScore,
    biteLabel: biteLabel(biteScore),
    summary,
    factors,
    picks,
    hourly,
    bestWindows: computeBestWindows(hourly),
    behavior: buildBehavior(c),
    clarityPlaybook: buildClarityPlaybook(c),
    pressurePlaybook: isPressured(c.pressureLevel)
      ? buildPressurePlaybook(c)
      : undefined,
  };
}

/** Move a presentation mood one step toward finesse. */
function downshift(mood: BiteMood): BiteMood {
  if (mood === 'aggressive') return 'neutral';
  return 'finesse';
}

type BiteMood = Presentation; // 'aggressive' | 'neutral' | 'finesse'

// ---------------------------------------------------------------------------
// Bite forecast
// ---------------------------------------------------------------------------

function scoreBite(c: Conditions): { score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 50; // neutral baseline

  // Barometric pressure trend is the single biggest mover. A falling glass
  // ahead of a front turns fish on; high-and-rising behind a front shuts them
  // down.
  switch (c.weather.pressureTrend) {
    case 'falling':
      score += 18;
      factors.push('Falling barometer — pre-front feeding window, fish are active.');
      break;
    case 'rising':
      score -= 12;
      factors.push('Rising barometer — post-front conditions, expect a tougher, tighter bite.');
      break;
    case 'steady':
      score += 4;
      factors.push('Stable pressure — a dependable, steady bite.');
      break;
    default:
      factors.push('Pressure trend unknown — judging by the rest of the picture.');
  }

  // Absolute pressure: very high bluebird pressure is classically tough.
  if (c.weather.pressureInHg >= 30.3) {
    score -= 6;
    factors.push('High bluebird pressure — fish often hold tight to cover.');
  } else if (c.weather.pressureInHg <= 29.8) {
    score += 4;
    factors.push('Low pressure — often coincides with active feeding.');
  }

  // Water temperature vs. a broad "active" window.
  const wt = c.water.waterTempF;
  if (wt >= 60 && wt <= 80) {
    score += 12;
    factors.push(`Water temp ${wt}°F is in the prime activity range.`);
  } else if ((wt >= 50 && wt < 60) || (wt > 80 && wt <= 86)) {
    score += 4;
    factors.push(`Water temp ${wt}°F supports a moderate bite.`);
  } else if (wt < 50) {
    score -= 10;
    factors.push(`Cold water (${wt}°F) — slow down and downsize.`);
  } else {
    score -= 8;
    factors.push(`Hot water (${wt}°F) — fish go deep or feed early and late.`);
  }
  if (c.water.isEstimated) {
    factors.push('Water temp is estimated from air temp (no measured reading nearby).');
  }

  // Wind: a light chop is ideal; dead calm and gales are both harder.
  const wind = c.weather.windMph;
  if (wind >= 5 && wind <= 15) {
    score += 8;
    factors.push(`A ${wind} mph breeze gives a fish-friendly chop and wind-blown bait.`);
  } else if (wind < 3) {
    score -= 4;
    factors.push('Near-calm, slick water — fish may spook; go subtle.');
  } else if (wind > 22) {
    score -= 8;
    factors.push(`Strong wind (${wind} mph) — fishable spots and boat control get hard.`);
  }
  // Old angling saw: wind from the east, fish bite the least.
  const dir = c.weather.windDirectionLabel;
  if (dir.startsWith('E')) {
    score -= 3;
    factors.push('Easterly wind — traditionally a slower bite.');
  } else if (dir.startsWith('W') || dir.startsWith('S')) {
    score += 2;
  }

  // Sky / light. Overcast spreads fish out and extends the feed; bright sun
  // pins them to cover and shade.
  switch (c.weather.sky) {
    case 'overcast':
      score += 8;
      factors.push('Overcast skies — low light keeps fish roaming and feeding.');
      break;
    case 'partly_cloudy':
      score += 4;
      break;
    case 'clear':
      if (c.weather.isDay) {
        score -= 2;
        factors.push('Bright sun — fish hold tight to shade and cover; fish early/late.');
      }
      break;
  }

  // Time of day: dawn/dusk low light is prime.
  if (!c.weather.isDay) {
    score += 4;
    factors.push('Low-light period — a prime feeding window.');
  }

  // Tide (saltwater): moving water feeds; slack water stalls.
  if (c.tide) {
    if (c.tide.state === 'incoming' || c.tide.state === 'outgoing') {
      score += 8;
      factors.push(`${cap(c.tide.state)} tide — moving water positions bait and triggers feeding.`);
    } else if (c.tide.state === 'slack') {
      score -= 6;
      factors.push('Slack tide — bite often pauses until the water moves again.');
    }
  }

  // Fishing pressure: educated fish are warier and harder to fool.
  const penalty = pressureBitePenalty(c.pressureLevel);
  if (penalty > 0) {
    score -= penalty;
    factors.push(
      c.pressureLevel === 'high'
        ? 'Heavily pressured water — fish have seen it all; expect a tough, selective bite.'
        : 'Moderately pressured water — fish are a bit wary; finesse helps.',
    );
  }

  return { score: clamp(Math.round(score), 1, 99), factors };
}

function biteMood(score: number): BiteMood {
  if (score >= 66) return 'aggressive';
  if (score >= 45) return 'neutral';
  return 'finesse';
}

// ---------------------------------------------------------------------------
// Hourly bite + best windows
// ---------------------------------------------------------------------------

/** Grade the bite for each available hour of the day. */
function buildHourly(c: Conditions): HourBite[] {
  return c.hourlyWeather.map((hw) => {
    const perHour: Conditions = {
      ...c,
      weather: hw,
      tide: c.tide
        ? { ...c.tide, state: tideStateAt(c.tide.events, new Date(hw.timeISO).getTime()) }
        : null,
    };
    let score = scoreBite(perHour).score;
    score += dawnDuskBonus(hw.timeISO, hw.sunrise, hw.sunset);
    return {
      timeISO: hw.timeISO,
      label: hourLabel(hw.timeISO),
      score: clamp(Math.round(score), 1, 99),
      isDay: hw.isDay,
    };
  });
}

/** Bonus for the prime change-of-light hours around sunrise and sunset. */
function dawnDuskBonus(timeISO: string, sunrise: string, sunset: string): number {
  const h = hourOf(timeISO);
  const sr = Number(sunrise.slice(0, 2));
  const ss = Number(sunset.slice(0, 2));
  if (Number.isNaN(h)) return 0;
  const nearSunrise = !Number.isNaN(sr) && Math.abs(h - sr) <= 1;
  const nearSunset = !Number.isNaN(ss) && Math.abs(h - ss) <= 1;
  return nearSunrise || nearSunset ? 8 : 0;
}

/** Group the strongest contiguous hours into a few highlighted windows. */
function computeBestWindows(hourly: HourBite[]): BestWindow[] {
  if (hourly.length === 0) return [];
  const peak = Math.max(...hourly.map((h) => h.score));
  const threshold = Math.max(55, peak - 12);

  const windows: BestWindow[] = [];
  let start: HourBite | null = null;
  let prev: HourBite | null = null;
  let runPeak = 0;

  const close = () => {
    if (start && prev) {
      const range =
        start === prev ? start.label : `${start.label}–${prev.label}`;
      windows.push({ range, biteLabel: biteLabel(runPeak), score: runPeak });
    }
    start = null;
    prev = null;
    runPeak = 0;
  };

  for (const h of hourly) {
    if (h.score >= threshold) {
      if (!start) start = h;
      prev = h;
      runPeak = Math.max(runPeak, h.score);
    } else {
      close();
    }
  }
  close();

  return windows.sort((a, b) => b.score - a.score).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Lure / rig / bait ranking
// ---------------------------------------------------------------------------

function rankPicks(c: Conditions, mood: BiteMood): LurePick[] {
  const scored = LURES
    .filter((l) => l.waterTypes.includes(c.waterType))
    .map((l) => scoreLure(l, c, mood))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  // Return a fuller ranked pool (up to 10 per category) so the UI can both show
  // a varied "All" view (top few of each) and let the user filter to Lures /
  // Rigs / Bait and see a deep top-10 list in each. The "All" curation happens
  // in the UI.
  const perCategoryCap = 10;
  const counts: Record<string, number> = {};
  const out: LurePick[] = [];
  for (const pick of scored) {
    const n = counts[pick.category] ?? 0;
    if (n >= perCategoryCap) continue;
    counts[pick.category] = n + 1;
    out.push(pick);
  }
  return out;
}

function scoreLure(l: LureEntry, c: Conditions, mood: BiteMood): LurePick {
  let score = l.baseScore * 40; // 0-40 from intrinsic versatility
  const reasons: string[] = [];

  // Presentation vs. the day's mood is the biggest factor.
  if (l.presentation === mood) {
    score += 28;
  } else if (
    (mood === 'neutral' && l.presentation !== 'neutral') ||
    (l.presentation === 'neutral' && mood !== 'neutral')
  ) {
    score += 12; // neutral baits are a safe partial match either way
  } else {
    score -= 6; // aggressive on a finesse day (or vice-versa)
  }

  // Structure / cover match.
  if (l.structures.length === 0) {
    score += 6;
  } else {
    const overlap = c.structures.filter((s) => l.structures.includes(s));
    if (overlap.length > 0) {
      score += 14 + (overlap.length - 1) * 4;
      reasons.push(`fits the ${overlap.join(' & ')} you reported`);
    } else if (c.structures.length > 0) {
      score -= 8;
    }
  }

  // Water-temp window.
  const wt = c.water.waterTempF;
  if (wt >= l.minWaterF && wt <= l.maxWaterF) {
    score += 12;
    reasons.push(`in its ${l.minWaterF}-${l.maxWaterF}°F window`);
  } else {
    const miss = wt < l.minWaterF ? l.minWaterF - wt : wt - l.maxWaterF;
    score -= Math.min(20, miss * 0.8);
    if (miss > 12) score -= 8;
  }

  // Sky preference.
  if (l.skies.length === 0 || l.skies.includes(c.weather.sky)) {
    if (l.skies.includes(c.weather.sky)) {
      score += 8;
      reasons.push(`strong under ${skyWord(c.weather.sky)} skies`);
    }
  } else {
    score -= 4;
  }

  // Target species bias. Lures that name any selected species get a strong
  // boost; species-specific lures that match none get pushed down.
  if (c.species.length > 0 && l.species) {
    const match = c.species.find((s) => l.species!.includes(s));
    if (match) {
      score += 20;
      reasons.unshift(`a go-to for ${speciesLabel(match)}`);
    } else {
      score -= 12;
    }
  }

  // Pressured water: reward subtle/natural baits, bury loud reaction baits
  // that educated fish ignore. Magnitude scales with the pressure level.
  if (isPressured(c.pressureLevel)) {
    if (l.pressureFriendly) {
      score += pressureFriendlyBonus(c.pressureLevel);
      reasons.push('subtle enough for pressured, educated fish');
    }
    if (l.presentation === 'aggressive') {
      score -= aggressivePenalty(c.pressureLevel);
    }
  }

  // Water clarity: dirty water rewards vibration/flash/scent, clear water
  // rewards subtle/natural looks.
  const clarity = clarityLureAdjust(l, c.clarity);
  score += clarity.delta;
  if (clarity.reason) reasons.push(clarity.reason);

  // Depth zone: favor baits that work the column the user is fishing.
  const depth = depthLureAdjust(l, c.depth);
  score += depth.delta;
  if (depth.reason) reasons.push(depth.reason);

  // Lead with the lure's signature strength, then condition-specific reasons.
  const reasonText = [l.strength, ...reasons].join('; ');

  return {
    name: l.name,
    category: l.category,
    details: l.details,
    howTo: l.howTo,
    art: l.art,
    reason: cap(reasonText) + '.',
    gear: gearFor(l.name),
    score: clamp(Math.round(score), 0, 100),
  };
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

function buildSummary(c: Conditions, score: number, mood: BiteMood): string {
  const target =
    c.species.length === 0
      ? ''
      : ` for ${c.species.map(speciesLabel).join(', ')}`;
  const place = `${c.waterType === 'saltwater' ? 'Inshore salt' : 'Freshwater'}${target}`;
  const moodWord =
    mood === 'aggressive'
      ? 'Fish should be willing to chase — lead with moving baits and reaction lures'
      : mood === 'finesse'
        ? 'Expect a picky bite — slow down, downsize, and fish high-confidence presentations'
        : 'A balanced day — a versatile, moderate-speed approach should produce';

  const tideBit =
    c.tide && (c.tide.state === 'incoming' || c.tide.state === 'outgoing')
      ? ` Fish the moving (${c.tide.state}) water while it lasts.`
      : c.tide && c.tide.state === 'slack'
        ? ' Wait for the tide to start moving again for the best window.'
        : '';

  return (
    `${place} outlook: bite forecast ${score}/100 (${biteLabel(score)}). ` +
    `${moodWord}. ` +
    `Surface water is ${c.water.waterTempF}°F${c.water.isEstimated ? ' (est.)' : ''}, ` +
    `air ${c.weather.airTempF}°F, ${c.weather.pressureInHg}" and ${c.weather.pressureTrend}, ` +
    `wind ${c.weather.windMph} mph ${c.weather.windDirectionLabel} under ${skyWord(c.weather.sky)} skies, ` +
    `${c.clarity} water.` +
    tideBit
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Word grade for a bite score — shared with the hourly sheet's header pill. */
export function biteLabel(score: number): string {
  if (score >= 75) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 45) return 'Fair';
  if (score >= 30) return 'Slow';
  return 'Tough';
}

function skyWord(sky: Conditions['weather']['sky']): string {
  return sky === 'partly_cloudy' ? 'partly cloudy' : sky;
}

function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
