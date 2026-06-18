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

/**
 * Build a complete fishing strategy from gathered conditions using a
 * transparent rule-based model. Every number here encodes a widely-held
 * angling heuristic; the goal is explainable, not magic.
 */
export function buildStrategy(c: Conditions): Strategy {
  const { score: biteScore, factors } = scoreBite(c);
  // Pressured water nudges the approach toward finesse: one notch for moderate,
  // straight to finesse for high.
  let mood = biteMood(biteScore);
  if (c.pressureLevel === 'moderate') mood = downshift(mood);
  else if (c.pressureLevel === 'high') mood = 'finesse';

  const picks = rankPicks(c, mood);
  const summary = buildSummary(c, biteScore, mood);

  if (c.species !== 'any') {
    const tip = speciesTip(c.species);
    if (tip) factors.push(`Targeting ${speciesLabel(c.species)}: ${tip}`);
  }

  return {
    biteScore,
    biteLabel: biteLabel(biteScore),
    summary,
    factors,
    picks,
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
// Lure / rig / bait ranking
// ---------------------------------------------------------------------------

function rankPicks(c: Conditions, mood: BiteMood): LurePick[] {
  const scored = LURES
    .filter((l) => l.waterTypes.includes(c.waterType))
    .map((l) => scoreLure(l, c, mood))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score);

  // Keep variety: surface a couple of baits/rigs alongside lures rather than
  // an all-crankbait list. Take the top picks but cap per category.
  const perCategoryCap = 3;
  const counts: Record<string, number> = {};
  const out: LurePick[] = [];
  for (const pick of scored) {
    const n = counts[pick.category] ?? 0;
    if (n >= perCategoryCap) continue;
    counts[pick.category] = n + 1;
    out.push(pick);
    if (out.length >= 6) break;
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

  // Target species bias. Lures that name the species get a strong boost;
  // species-specific lures that don't name it get pushed down.
  if (c.species !== 'any' && l.species) {
    if (l.species.includes(c.species)) {
      score += 20;
      reasons.unshift(`a go-to for ${speciesLabel(c.species)}`);
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

  // Lead with the lure's signature strength, then condition-specific reasons.
  const reasonText = [l.strength, ...reasons].join('; ');

  return {
    name: l.name,
    category: l.category,
    details: l.details,
    reason: cap(reasonText) + '.',
    score: clamp(Math.round(score), 0, 100),
  };
}

// ---------------------------------------------------------------------------
// Narrative
// ---------------------------------------------------------------------------

function buildSummary(c: Conditions, score: number, mood: BiteMood): string {
  const target =
    c.species === 'any' ? '' : ` for ${speciesLabel(c.species)}`;
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
    `wind ${c.weather.windMph} mph ${c.weather.windDirectionLabel} under ${skyWord(c.weather.sky)} skies.` +
    tideBit
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function biteLabel(score: number): string {
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
