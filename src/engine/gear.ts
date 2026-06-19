import type { GearSpec } from '@/types';

/**
 * Recommended tackle for each lure/rig/bait, keyed by name. Kept separate from
 * the lure database so the bait list stays readable. "Built-in" hook means the
 * hook comes on the lure/jighead. These are sensible starting points, not law.
 */
export const GEAR: Record<string, GearSpec> = {
  'Lipless Crankbait': {
    rod: 'Medium, moderate action',
    line: '12-15 lb fluorocarbon',
    hook: 'Stock #4 trebles (upgrade to round bend)',
  },
  'Squarebill Crankbait': {
    rod: 'Medium, moderate (glass or composite)',
    line: '12-15 lb fluorocarbon/mono',
    hook: 'Stock #2-4 trebles',
  },
  Spinnerbait: {
    rod: 'Medium-heavy, fast',
    line: '15-17 lb fluoro / 30-50 lb braid',
    hook: 'Built-in 4/0-5/0 (add a trailer hook)',
  },
  'Topwater Walking Bait': {
    rod: 'Medium-heavy, moderate-fast',
    line: '30-40 lb braid (floats) or 15 lb mono',
    hook: 'Stock #4 trebles',
  },
  'Hollow-Body Frog': {
    rod: 'Heavy, fast',
    line: '40-65 lb braid',
    hook: 'Built-in double 4/0',
  },
  'Chatterbait (Bladed Jig)': {
    rod: 'Medium-heavy, fast',
    line: '15-20 lb fluoro / 30-50 lb braid',
    hook: 'Built-in 4/0-5/0',
  },
  Jerkbait: {
    rod: 'Medium, fast (spinning or casting)',
    line: '8-12 lb fluorocarbon',
    hook: 'Stock #5-6 trebles',
  },
  'Swim Jig': {
    rod: 'Medium-heavy, fast',
    line: '15-20 lb fluoro / braid',
    hook: 'Built-in 4/0-5/0',
  },
  'Texas-Rigged Soft Plastic': {
    rod: 'Medium-heavy, fast',
    line: '15-20 lb fluoro (braid in grass)',
    hook: '3/0-4/0 EWG worm hook',
  },
  'Wacky-Rigged Stickbait': {
    rod: 'Medium, fast (spinning)',
    line: '8-10 lb fluoro or braid + leader',
    hook: '#1-1/0 wacky / octopus',
  },
  'Ned Rig': {
    rod: 'Medium-light, fast (spinning)',
    line: '6-10 lb braid + fluoro leader',
    hook: '1/15-1/10 oz mushroom jig (built-in)',
  },
  'Drop-Shot Rig': {
    rod: 'Medium-light, fast (spinning)',
    line: '6-8 lb braid + 6-8 lb fluoro leader',
    hook: '#1-2 drop-shot / octopus',
  },
  'Football Jig': {
    rod: 'Medium-heavy to heavy, fast',
    line: '12-15 lb fluorocarbon',
    hook: 'Built-in 4/0-5/0',
  },
  'Inline Spinner': {
    rod: 'Light-medium, moderate (spinning)',
    line: '4-8 lb mono/fluoro',
    hook: 'Built-in #4-8 treble',
  },
  'Live Minnow under a Slip Float': {
    rod: 'Light, moderate (spinning)',
    line: '4-6 lb mono',
    hook: '#4-6 Aberdeen / light wire',
  },
  'Curly-Tail Grub on Jighead': {
    rod: 'Light-medium, fast (spinning)',
    line: '4-8 lb mono/fluoro',
    hook: '1/8-1/4 oz jighead (built-in)',
  },
  Nightcrawlers: {
    rod: 'Light-medium (spinning)',
    line: '6-10 lb mono',
    hook: '#6-1/0 baitholder',
  },
  'Soft Plastic Paddletail on Jighead': {
    rod: 'Medium, fast',
    line: '10-20 lb braid + 20-30 lb fluoro leader',
    hook: '1/4-3/8 oz jighead (built-in)',
  },
  'Gold/Silver Spoon': {
    rod: 'Medium-heavy, fast',
    line: '15-20 lb braid + 30 lb leader',
    hook: 'Built-in 3/0-4/0 (weedless single)',
  },
  'Popping Cork + Shrimp': {
    rod: 'Medium, moderate-fast (7\'+)',
    line: '10-15 lb braid + 20-30 lb fluoro leader',
    hook: '1/0-3/0 circle or kahle',
  },
  'Suspending Twitchbait': {
    rod: 'Medium, fast',
    line: '10-15 lb braid + 20 lb leader',
    hook: 'Stock #4-6 trebles',
  },
  'Live Shrimp': {
    rod: 'Medium, moderate-fast',
    line: '10-15 lb braid + 20-30 lb leader',
    hook: '1/0-3/0 circle',
  },
  'Cut/Live Baitfish': {
    rod: 'Medium-heavy, moderate (surf/bottom)',
    line: '15-30 lb mono/braid + leader',
    hook: '2/0-6/0 circle (match the bait)',
  },
  'Bucktail Jig': {
    rod: 'Medium, fast',
    line: '10-20 lb braid + 20-30 lb leader',
    hook: 'Built-in (1/4-1 oz head)',
  },
};

export function gearFor(name: string): GearSpec | undefined {
  return GEAR[name];
}
