import type { Conditions, WaterDepth } from '@/types';
import type { LureEntry } from '@/engine/lureDatabase';

/**
 * Which depth zones each bait naturally works. Kept by name so the lure
 * database stays clean. Baits not listed are treated as depth-flexible.
 */
const DEPTHS: Record<string, WaterDepth[]> = {
  'Topwater Walking Bait': ['shallow'],
  'Hollow-Body Frog': ['shallow'],
  'Popping Cork + Shrimp': ['shallow'],
  'Squarebill Crankbait': ['shallow', 'mid'],
  Spinnerbait: ['shallow', 'mid'],
  'Chatterbait (Bladed Jig)': ['shallow', 'mid'],
  'Swim Jig': ['shallow', 'mid'],
  'Lipless Crankbait': ['shallow', 'mid'],
  Jerkbait: ['shallow', 'mid'],
  'Suspending Twitchbait': ['shallow', 'mid'],
  'Gold/Silver Spoon': ['shallow', 'mid'],
  'Inline Spinner': ['shallow', 'mid'],
  'Soft Plastic Paddletail on Jighead': ['shallow', 'mid', 'deep'],
  'Texas-Rigged Soft Plastic': ['shallow', 'mid', 'deep'],
  'Wacky-Rigged Stickbait': ['shallow', 'mid'],
  'Curly-Tail Grub on Jighead': ['mid', 'deep'],
  'Ned Rig': ['mid', 'deep'],
  'Drop-Shot Rig': ['mid', 'deep'],
  'Football Jig': ['mid', 'deep'],
  'Bucktail Jig': ['mid', 'deep'],
  'Live Minnow under a Slip Float': ['shallow', 'mid', 'deep'],
  'Live Shrimp': ['shallow', 'mid', 'deep'],
  'Cut/Live Baitfish': ['mid', 'deep'],
  Nightcrawlers: ['shallow', 'mid', 'deep'],
};

export function depthLureAdjust(
  l: LureEntry,
  depth: WaterDepth,
): { delta: number; reason?: string } {
  if (depth === 'any') return { delta: 0 };
  const zones = DEPTHS[l.name];
  if (!zones) return { delta: 0 };
  if (zones.includes(depth)) {
    return { delta: 10, reason: `reaches the ${depth} zone you're fishing` };
  }
  return { delta: -10 };
}

/** A short note on where in the column to focus, for the behavior read. */
export function depthBehavior(c: Conditions): string | null {
  switch (c.depth) {
    case 'shallow':
      return 'You\'re fishing shallow (≈0–5 ft) — focus on cover, banks, and flats, and keep baits up in the column; topwater and moving baits shine here in low light.';
    case 'mid':
      return 'You\'re fishing the mid-column (≈5–15 ft) — work depth breaks, weed edges, and cover with crankbaits, swimbaits, and jigs that hunt that zone.';
    case 'deep':
      return 'You\'re fishing deep (≈15 ft+) — fish hold on structure, ledges, and the thermocline; slow bottom presentations (drop-shot, football jig, bucktail, live bait) keep the lure in their face.';
    default:
      return null;
  }
}
