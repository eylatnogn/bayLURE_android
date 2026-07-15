import type { Conditions, PlaybookSection, WaterClarity } from '@/types';
import type { LureEntry } from '@/engine/lureDatabase';
import { speciesLabel } from '@/engine/species';

/**
 * Lure-score adjustment for the water clarity. Dirty water rewards
 * vibration/flash/scent and punishes subtle natural baits fish can't find;
 * gin-clear water flips it.
 */
export function clarityLureAdjust(
  l: LureEntry,
  clarity: WaterClarity,
): { delta: number; reason?: string } {
  if (clarity === 'muddy') {
    if (l.dirtyWaterFriendly) {
      return { delta: 14, reason: 'vibration/flash/scent fish can find in dirty water' };
    }
    // Subtle, natural, finesse baits get lost in muddy water.
    if (l.presentation === 'finesse' || l.pressureFriendly) {
      return { delta: -10 };
    }
    return { delta: 0 };
  }

  if (clarity === 'clear') {
    if (l.pressureFriendly || l.presentation === 'finesse') {
      return { delta: 10, reason: 'natural, subtle look for clear water' };
    }
    // Loud, flashy reaction baits can be too much in gin-clear water.
    if (l.dirtyWaterFriendly && l.presentation === 'aggressive') {
      return { delta: -6 };
    }
    return { delta: 0 };
  }

  // Stained: the in-between. A slight nod to baits with some thump/visibility.
  if (l.dirtyWaterFriendly) return { delta: 5 };
  return { delta: 0 };
}

/** Detailed, clarity-specific color / vibration / location playbook. */
export function buildClarityPlaybook(c: Conditions): PlaybookSection[] {
  const target =
    c.species.length === 0
      ? ''
      : ` for ${c.species.map(speciesLabel).join(', ')}`;

  if (c.clarity === 'muddy') {
    return [
      {
        title: 'Color & visibility',
        tips: [
          'Go bold: solid dark silhouettes (black/blue, junebug, black) or loud brights (chartreuse, firetiger, orange) so the bait stands out against zero visibility.',
          'A strong, single-color silhouette beats subtle, translucent patterns muddy fish will never see.',
        ],
      },
      {
        title: 'Vibration, sound & scent',
        tips: [
          'Pick baits that push water and rattle — Colorado-blade spinnerbaits, lipless cranks, chatterbaits, thumping paddletails.',
          'Add scent or use natural/cut bait: when sight fails, fish hunt by smell and lateral line.',
        ],
      },
      {
        title: 'Where to cast',
        tips: [
          'Pitch INTO the cover, not near it — lay the bait against the log, dock post, grass edge or rock. Dirty-water fish sit tight and won\'t chase.',
          'Fish the shallowest cover first (1–4 ft): mud warms fast and pushes bait — and fish — up shallow.',
          'Hunt current seams, creek mouths, and inside bends where moving water stacks bait against a hard edge.',
          'Target incoming water — a feeder creek, culvert, or run-off after rain dumps warmer, bait-rich water fish stack on.',
        ],
      },
      {
        title: 'How to work it',
        tips: [
          'Slow-roll or crawl the bait so it stays in the strike zone; make repeat casts to the same target so fish can home in on the thump.',
          'Keep the bait in contact with the bottom or cover — muddy fish track it by feel, not sight.',
          `You\'re far less likely to spook them — get close, fish methodically, and pick apart high-percentage targets one at a time${target}.`,
        ],
      },
    ];
  }

  if (c.clarity === 'clear') {
    return [
      {
        title: 'Color & finish',
        tips: [
          'Match the hatch with natural, translucent colors — green pumpkin, watermelon, shad, ghost patterns.',
          'Dial back chrome and loud colors; a realistic, subdued look draws more strikes in high visibility.',
        ],
      },
      {
        title: 'Profile & presentation',
        tips: [
          'Downsize and use a more lifelike action; clear-water fish inspect a bait before committing.',
          'Lengthen casts and use lighter fluorocarbon so neither you nor the line gives you away.',
        ],
      },
      {
        title: 'Where to cast',
        tips: [
          'Cast long and keep your distance — fish (and the boat\'s shadow) are visible from a long way off in clear water.',
          'Target shade and depth: overhanging trees, docks, deep weed edges, bluff walls, and drop-offs where fish duck bright light.',
          'Work main-lake points, humps, and channel edges — clear-water fish suspend and roam deeper, harder structure.',
          'Cast past your target and swim the bait into it, so the fish sees the lure before it sees you.',
        ],
      },
      {
        title: 'How & when to work it',
        tips: [
          'Use a steady, natural swim with subtle action and long pauses over cover — let the bait glide, don\'t thrash it.',
          `Best in low light — dawn, dusk, overcast, or wind chop that breaks up the surface and hides your approach${target}.`,
        ],
      },
    ];
  }

  // Stained
  return [
    {
      title: 'Color & contrast',
      tips: [
        'Stained water loves contrast colors — chartreuse/white, black/chartreuse, or natural with a bright accent.',
        'A little flash or a gold blade helps without overdoing it.',
      ],
    },
    {
      title: 'Where to cast',
      tips: [
        'Run cover edges — cast to and parallel along grass lines, laydowns, riprap, and dock rows, keeping the bait tight to the break.',
        'Focus the 2–8 ft zone, and hunt any clarity edge where slightly clearer meets dirtier water — that seam is a feeding line.',
        'Cover water to find active fish, then slow down and pick apart the spots that produced a bite.',
      ],
    },
    {
      title: 'How to work it',
      tips: [
        'A moderate, steady retrieve covers water well; you can fish a bit more aggressively than in clear water.',
        `Around cover, slow down and keep the bait in the strike zone a beat longer${target}.`,
      ],
    },
  ];
}

/** A one-line clarity summary for the conditions readout. */
export function clarityLabel(clarity: WaterClarity): string {
  return clarity[0]!.toUpperCase() + clarity.slice(1);
}
