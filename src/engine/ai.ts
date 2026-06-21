import type { Conditions, Strategy } from '@/types';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

/**
 * Optional online enhancement. The rule-based engine always runs first and
 * stands on its own; when the user has supplied an Anthropic API key, this
 * sends the same conditions to Claude for a richer, conversational read and
 * returns the narrative to attach to the strategy.
 *
 * Returns null on any failure so the app silently falls back to rules-only.
 *
 * NOTE: For a shipping app, proxy this through your own backend rather than
 * embedding a key in the client. This direct path is for prototyping.
 */
export async function enhanceWithClaude(
  conditions: Conditions,
  strategy: Strategy,
  apiKey: string,
): Promise<string | null> {
  if (!apiKey) return null;

  const prompt = buildPrompt(conditions, strategy);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system:
          'You are an expert multi-species fishing guide. Given live conditions and a ' +
          'rule-based recommendation, give a concise, confident game plan: where to fish, ' +
          'how to work the top lure, and what to change if the bite is slow. Be specific and ' +
          'practical. Do not invent data not provided.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function buildPrompt(c: Conditions, s: Strategy): string {
  const tide = c.tide
    ? `Tide: ${c.tide.state}, station ${c.tide.stationName} (${c.tide.stationDistanceMi} mi).`
    : 'Tide: n/a (freshwater or no nearby station).';

  return [
    `Water type: ${c.waterType}.`,
    `Target species: ${c.species.length === 0 ? 'angler is open to anything' : c.species.join(', ')}.`,
    `Fishing pressure: ${c.pressureLevel === 'none' ? 'normal' : `${c.pressureLevel} — educated fish, favor finesse and downsizing`}.`,
    `Structure/cover present: ${c.structures.join(', ') || 'unspecified'}.`,
    `Water clarity: ${c.clarity}.`,
    `Depth zone: ${c.depth}.`,
    `Air: ${c.weather.airTempF}°F. Water: ${c.water.waterTempF}°F${c.water.isEstimated ? ' (estimated)' : ''}.`,
    `Pressure: ${c.weather.pressureInHg} inHg, trend ${c.weather.pressureTrend}.`,
    `Wind: ${c.weather.windMph} mph from ${c.weather.windDirectionLabel}, gusts ${c.weather.windGustMph}.`,
    `Sky: ${c.weather.sky}, ${c.weather.isDay ? 'daytime' : 'low light'}. ${c.weather.weatherLabel}.`,
    tide,
    '',
    `Rule-engine bite forecast: ${s.biteScore}/100 (${s.biteLabel}).`,
    `Top picks: ${s.picks.slice(0, 4).map((p) => p.name).join(', ')}.`,
    '',
    'Write a short game plan (4-6 sentences).',
  ].join('\n');
}
