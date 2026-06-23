import type { Conditions, PlaybookSection, PressureLevel } from '@/types';
import { speciesLabel } from '@/engine/species';

export function isPressured(level: PressureLevel): boolean {
  return level !== 'none';
}

/** Bite-score penalty for the given pressure level. */
export function pressureBitePenalty(level: PressureLevel): number {
  if (level === 'high') return 11;
  if (level === 'moderate') return 6;
  return 0;
}

/** Lure-score bonus for pressure-friendly baits at this level. */
export function pressureFriendlyBonus(level: PressureLevel): number {
  if (level === 'high') return 18;
  if (level === 'moderate') return 12;
  return 0;
}

/** Lure-score penalty applied to loud reaction baits at this level. */
export function aggressivePenalty(level: PressureLevel): number {
  if (level === 'high') return 16;
  if (level === 'moderate') return 8;
  return 0;
}

/**
 * A categorized finesse playbook for pressured water. Content scales with the
 * level: `moderate` gives the core adjustments, `high` adds the extreme
 * measures and an extra "when it's truly locked up" section.
 */
export function buildPressurePlaybook(c: Conditions): PlaybookSection[] {
  const level = c.pressureLevel;
  if (level === 'none') return [];
  const high = level === 'high';
  const salt = c.waterType === 'saltwater';

  const sections: PlaybookSection[] = [];

  // 1. Downsize & profile
  const downsize: string[] = [
    'Drop a size (or two): a smaller profile draws strikes from fish that have seen every popular bait this season.',
    salt
      ? 'Step jigheads down to 1/8–3/16 oz and shrink soft plastics to 3" so the bait falls slower and looks natural.'
      : 'Go from full-size plastics to 3–4" finesse worms, small craws, or a 2.75" stickbait on a light wire hook.',
  ];
  if (high) {
    downsize.push(
      'When nothing commits, go micro — 1.5–2" baits on a tiny jig will get bit when nothing else will.',
      'Use a more subtle action (straight or hand-poured tails) instead of big thumping paddletails.',
    );
  }
  sections.push({ title: 'Downsize & profile', tips: downsize });

  // 2. Color & finish
  const color: string[] = [
    'Lean on natural, translucent colors — green pumpkin, watermelon, clear/shad — and kill the chrome flash in clear water.',
    'Match the local forage size and tone rather than reaching for the loudest color in the box.',
  ];
  if (high) {
    color.push(
      'In gin-clear, heavily-pressured water, try a near-clear or "ghost" bait with subtle flake and no rattle.',
    );
  }
  sections.push({ title: 'Color & finish', tips: color });

  // 3. Line & leader
  const line: string[] = [
    'Lighten and lengthen: thinner fluorocarbon main line or leader so the connection disappears.',
    salt
      ? 'Drop leader to 15–20 lb fluoro (lighter where you can get away with it) and add length to keep it off the fish.'
      : 'Spinning gear with 6–10 lb fluoro or a fluoro leader off braid hides the line and lets light baits move freely.',
  ];
  if (high) {
    line.push('Go as light as your cover allows — line shy fish notice heavy line first.');
  }
  sections.push({ title: 'Line & leader', tips: line });

  // 4. Cadence & presentation
  const cadence: string[] = [
    'Slow everything down and add long pauses — deadstick the bait and let wary fish make the decision.',
    'Make longer casts and keep your distance; pressured fish spook from boat noise, shadows, and trolling-motor wash.',
  ];
  if (high) {
    cadence.push(
      'Dead-stick on the bottom for 10–20 seconds between tiny hops; most bites come on the pause.',
      'Show them something different from the crowd — if everyone throws moving baits, give them a motionless one.',
    );
  }
  sections.push({ title: 'Cadence & presentation', tips: cadence });

  // 5. Position & water
  const where: string[] = [
    'Fish the overlooked water — the spots between the obvious spots, the back of the cover, the bank everyone walks past.',
    salt
      ? 'Work edges and ambush points (mangrove roots, oyster edges, dock shadows) that get less casting traffic.'
      : 'Target isolated, hard-to-reach cover and deeper adjacent structure that bank/boat anglers can\'t easily hit.',
  ];
  if (high) {
    where.push('Move often and cover fresh, unpressured water rather than grinding a community hole.');
  }
  sections.push({ title: 'Position & water', tips: where });

  // 6. Timing
  sections.push({
    title: 'Timing',
    tips: [
      'Fish the off-hours — first light, last light, and weekdays — when the water sees the least pressure.',
      high
        ? 'After a front or a busy weekend, give it the low-light windows; midday bluebird on pressured water is the hardest bite there is.'
        : 'Low-light windows consistently out-produce midday on pressured water.',
    ],
  });

  // 7. Go-to bailout baits (species/water aware)
  const target =
    c.species.length === 0
      ? ''
      : ` dialed in for ${c.species.map(speciesLabel).join(', ')}`;
  const bailout = salt
    ? [
        `Light jighead + small paddletail or a free-lined live shrimp on a long fluoro leader${target}.`,
        'A natural-colored suspending twitchbait worked slowly is a great pressured-water option for trout and snook.',
      ]
    : [
        `Ned rig, drop-shot, and a weightless wacky stickbait are the classic pressured-water bailout trio${target}.`,
        'When all else fails, a live minnow or nightcrawler under a float will get bit.',
      ];
  sections.push({ title: 'Go-to bailout baits', tips: bailout });

  return sections;
}
