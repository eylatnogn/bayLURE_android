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
        title: 'Where fish hold & how to work it',
        tips: [
          'Fish move shallower and bury tight to cover in dirty water — put the bait right on the wood, grass, or rock.',
          'Slow down and make repeated casts to the same spot so fish can home in on the vibration.',
          `Fish are far less spooky now — get close and work high-percentage targets methodically${target}.`,
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
        title: 'Where fish hold & timing',
        tips: [
          'Fish hold deeper, under shade, or tight to cover to escape bright light — target those edges.',
          `Low-light windows (dawn, dusk, overcast, wind chop) are prime when the water is clear${target}.`,
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
      title: 'Presentation',
      tips: [
        'You can fish a bit more aggressively than in clear water — moderate vibration baits cover water well.',
        `Fish relate to cover and edges; keep the bait in the strike zone a little longer${target}.`,
      ],
    },
  ];
}

/** A one-line clarity summary for the conditions readout. */
export function clarityLabel(clarity: WaterClarity): string {
  return clarity[0]!.toUpperCase() + clarity.slice(1);
}
