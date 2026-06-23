import type { Conditions } from '@/types';
import { speciesLabel } from '@/engine/species';
import { depthBehavior } from '@/engine/depth';

/**
 * A plain-language read on what the fish are probably doing right now, built
 * from the same conditions the lure engine uses. Water temperature drives the
 * metabolic story; clarity drives how they sense prey; pressure (barometric and
 * fishing) and light shape the mood.
 */
export function buildBehavior(c: Conditions): string[] {
  const out: string[] = [];
  const wt = c.water.waterTempF;

  // Temperature / metabolism / location.
  if (wt < 45) {
    out.push(
      `At ${wt}°F the water is cold — fish are sluggish, metabolism is low, and they hold deep and tight in the warmest, most stable water. Expect short midday feeding windows and very subtle bites.`,
    );
  } else if (wt < 55) {
    out.push(
      `${wt}°F is a transition range — fish feed in the warmest part of the day and stage near deeper water adjacent to shallow flats. Bites build as the water warms through the afternoon.`,
    );
  } else if (wt <= 68) {
    out.push(
      `${wt}°F is prime — fish are active, roaming shallow, and willing to chase. This is when reaction baits and covering water pay off.`,
    );
  } else if (wt <= 80) {
    out.push(
      `${wt}°F is warm and active, but fish feed hardest early and late and slide to deeper, cooler, or more oxygenated water through the midday heat.`,
    );
  } else {
    out.push(
      `${wt}°F is hot — fish are stressed, holding deep, in current, or buried in shade and cover, and feed mostly in low light. Find moving or cooler water.`,
    );
  }

  // Clarity / how they sense prey.
  if (c.clarity === 'muddy') {
    out.push(
      'In muddy water fish rely on their lateral line and smell, not sight. They push shallow, hold tight to hard cover, and ambush close — they let a vibrating or scented bait come to them.',
    );
  } else if (c.clarity === 'clear') {
    out.push(
      'In clear water fish are sight-feeders and spooky — they use depth, shade, and cover to ambush, inspect baits closely, and are easily put off by heavy line, noise, and shadows.',
    );
  } else {
    out.push(
      'In stained water fish split the difference — they use both sight and vibration, relate tightly to cover and edges, and are a bit less wary than in clear water.',
    );
  }

  // Barometric trend / feeding mood.
  switch (c.weather.pressureTrend) {
    case 'falling':
      out.push('The falling barometer ahead of a change has them feeding — this is an active, opportunistic window.');
      break;
    case 'rising':
      out.push('Behind the front with rising pressure they get lockjaw — tighter to cover, less willing, needing a slow and precise presentation.');
      break;
    case 'steady':
      out.push('Stable pressure means a steady, predictable mood — no feeding frenzy, but a dependable bite.');
      break;
    default:
      break;
  }

  // Light level.
  if (!c.weather.isDay) {
    out.push('In this low light they roam and hunt more freely and push shallower — a prime feeding period.');
  } else if (c.weather.sky === 'clear') {
    out.push('Under bright sun they pin tight to shade and cover and feed less in the open — pick apart the shadows.');
  } else if (c.weather.sky === 'overcast') {
    out.push('The overcast keeps them roaming and feeding longer than a bluebird day would.');
  }

  // Fishing pressure / wariness.
  if (c.pressureLevel === 'high') {
    out.push('Heavy fishing pressure has made these fish cagey and conditioned — they have seen the popular baits and need something smaller, more natural, and different.');
  } else if (c.pressureLevel === 'moderate') {
    out.push('Moderate fishing pressure makes them a little selective — finesse and a natural look help.');
  }

  // Tide (saltwater).
  if (c.tide) {
    if (c.tide.state === 'incoming' || c.tide.state === 'outgoing') {
      out.push(`The ${c.tide.state} tide has bait moving and gamefish set up on ambush points feeding in the current.`);
    } else if (c.tide.state === 'slack') {
      out.push('On the slack tide they ease off and scatter — expect the bite to pick back up once the water moves.');
    }
  }

  // Depth focus.
  const depthNote = depthBehavior(c);
  if (depthNote) out.push(depthNote);

  // Moon phase: new/full moons drive stronger feeding and bigger tides.
  if (c.weather.moonMajor) {
    out.push(`A ${c.weather.moonPhase.toLowerCase()} means stronger feeding activity and bigger tidal swings — fish the major and minor periods around moonrise/overhead.`);
  }

  // Target-species emphasis.
  if (c.species.length > 0) {
    const names = c.species.map(speciesLabel).join(', ');
    out.push(`Focus on ${names}: lean into the spots and presentations above that fit how they hunt in these conditions.`);
  }

  return out;
}
