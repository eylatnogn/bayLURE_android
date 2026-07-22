import type { Coordinates, RiverFlow } from '@/types';
import { distanceMiles, round } from '@/utils/format';

// USGS Water Services: real-time streamflow from ~10k gauges. US-government
// data — free, no key, commercial use OK (same footing as NWS/NOAA/USGS maps).
// Two calls: find active discharge gauges near the spot (RDB site service),
// then read the nearest gauge's last ~2 days of 15-minute discharge readings.
const SITES_URL = 'https://waterservices.usgs.gov/nwis/site/';
const IV_URL = 'https://waterservices.usgs.gov/nwis/iv/';

/** Discharge, cubic feet per second. */
const PARAM_DISCHARGE = '00060';

/** Beyond this, a gauge stops describing the water the angler is on. */
const MAX_GAUGE_MILES = 15;

interface Gauge {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Parse USGS RDB (tab-separated with # comments and a format row under the
 * header) into gauges. Column order varies by query, so read the header.
 */
function parseRdbGauges(rdb: string): Gauge[] {
  const lines = rdb.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length < 2) return [];
  const header = lines[0]!.split('\t');
  const col = (name: string) => header.indexOf(name);
  const iId = col('site_no');
  const iName = col('station_nm');
  const iLat = col('dec_lat_va');
  const iLng = col('dec_long_va');
  if (iId < 0 || iLat < 0 || iLng < 0) return [];
  const out: Gauge[] = [];
  // lines[1] is the RDB field-size row ("5s\t15s\t…") — skip it.
  for (const line of lines.slice(2)) {
    const cells = line.split('\t');
    const lat = Number(cells[iLat]);
    const lng = Number(cells[iLng]);
    const id = cells[iId];
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ id, name: cells[iName] || id, lat, lng });
  }
  return out;
}

interface IvJson {
  value?: {
    timeSeries?: Array<{
      values?: Array<{ value?: Array<{ value?: string; dateTime?: string }> }>;
    }>;
  };
}

/**
 * River flow at the nearest active USGS discharge gauge within ~15 miles, or
 * null when there is none (typical for lakes and salt water). Throws only on
 * network/HTTP failure so the caller can decide how to degrade.
 */
export async function fetchRiverFlow(coords: Coordinates): Promise<RiverFlow | null> {
  // ~0.2° box (~14 mi) around the spot; distance-filtered properly below.
  const west = (coords.longitude - 0.2).toFixed(4);
  const south = (coords.latitude - 0.2).toFixed(4);
  const east = (coords.longitude + 0.2).toFixed(4);
  const north = (coords.latitude + 0.2).toFixed(4);
  const siteParams = new URLSearchParams({
    format: 'rdb',
    bBox: `${west},${south},${east},${north}`,
    parameterCd: PARAM_DISCHARGE,
    siteType: 'ST', // streams only
    siteStatus: 'active',
    hasDataTypeCd: 'iv',
  });
  const sitesRes = await fetch(`${SITES_URL}?${siteParams.toString()}`);
  // 404 = "no sites matched" for this service, not an error.
  if (sitesRes.status === 404) return null;
  if (!sitesRes.ok) throw new Error(`Gauge lookup failed (${sitesRes.status}).`);
  const gauges = parseRdbGauges(await sitesRes.text());

  let best: Gauge | null = null;
  let bestMi = Infinity;
  for (const g of gauges) {
    const d = distanceMiles(coords, { latitude: g.lat, longitude: g.lng });
    if (d < bestMi) {
      bestMi = d;
      best = g;
    }
  }
  if (!best || bestMi > MAX_GAUGE_MILES) return null;

  const ivParams = new URLSearchParams({
    format: 'json',
    sites: best.id,
    parameterCd: PARAM_DISCHARGE,
    period: 'P2D',
  });
  const ivRes = await fetch(`${IV_URL}?${ivParams.toString()}`);
  if (!ivRes.ok) throw new Error(`Flow read failed (${ivRes.status}).`);
  const data = (await ivRes.json()) as IvJson;
  const series = (data.value?.timeSeries?.[0]?.values?.[0]?.value ?? [])
    .map((v) => ({ cfs: Number(v.value), t: Date.parse(v.dateTime ?? '') }))
    // -999999 is USGS's ice/equipment sentinel; drop it and anything unparsable.
    .filter((v) => Number.isFinite(v.cfs) && v.cfs > -100000 && Number.isFinite(v.t));
  if (series.length === 0) return null;

  const latest = series[series.length - 1]!;
  // Reading closest to 24 h before the latest, for the day-over-day trend.
  const target = latest.t - 24 * 3600000;
  let ago = series[0]!;
  for (const v of series) {
    if (Math.abs(v.t - target) < Math.abs(ago.t - target)) ago = v;
  }
  const changePct =
    ago.cfs > 0 && Math.abs(latest.t - ago.t) > 12 * 3600000
      ? round(((latest.cfs - ago.cfs) / ago.cfs) * 100, 0)
      : null;

  return {
    cfs: round(latest.cfs, 0),
    changePct,
    siteName: best.name,
    distanceMi: round(bestMi, 1),
  };
}
