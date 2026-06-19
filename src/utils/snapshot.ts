import type { CatchConditions, Conditions } from '@/types';

/**
 * Compress a full analyzed `Conditions` (plus the resulting bite score and a
 * place label) into the small snapshot stored with a logged catch. This is the
 * seed of a training dataset: over time it links "what worked" to "the
 * conditions it worked in".
 */
export function buildCatchConditions(
  c: Conditions,
  biteScore: number,
  place: string,
): CatchConditions {
  return {
    capturedAt: c.fetchedAt,
    place: place || undefined,
    latitude: c.coordinates.latitude,
    longitude: c.coordinates.longitude,
    waterType: c.waterType,
    targetSpecies: c.species,
    structures: c.structures,
    pressureLevel: c.pressureLevel,
    clarity: c.clarity,
    airTempF: c.weather.airTempF,
    waterTempF: c.water.waterTempF,
    waterTempEstimated: c.water.isEstimated,
    pressureInHg: c.weather.pressureInHg,
    pressureTrend: c.weather.pressureTrend,
    windMph: c.weather.windMph,
    windDirectionLabel: c.weather.windDirectionLabel,
    sky: c.weather.sky,
    tideState: c.tide?.state,
    biteScore,
  };
}

/** A one-line human summary of a saved snapshot for the catch card. */
export function summarizeCatchConditions(s: CatchConditions): string {
  const parts = [
    `${s.waterTempF}°F water`,
    `${s.clarity}`,
    `${s.pressureInHg}" ${s.pressureTrend}`,
    `wind ${s.windMph} ${s.windDirectionLabel}`,
  ];
  if (s.tideState && s.tideState !== 'unknown') parts.push(`${s.tideState} tide`);
  if (typeof s.biteScore === 'number') parts.push(`bite ${s.biteScore}`);
  return parts.join(' · ');
}
