// Water-depth reads from NOAA NCEI's "DEM global mosaic" ImageServer. The
// mosaic auto-selects the best available raster per point: ~3 m near US coasts
// (the surveyed coastal DEMs), GEBCO-class in the open ocean, land elevation
// inland. Values are metres, negative below sea level — the same sign the map's
// contour/shading code already expects. Unlike the old GEBCO endpoint this one
// sends `Access-Control-Allow-Origin: *`, so it works from the web build too,
// and it takes the whole grid in a single call (no per-request cap or throttle).
const NCEI_SAMPLES =
  'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer/getSamples';

/**
 * Sample elevations (metres, negative = below sea level) at each [lat, lng]
 * cell, returned in the SAME order — with `null` where the DEM had no reading.
 * One POST for the whole grid (the geometry is too large for a GET URL).
 */
export async function fetchDemMeters(
  cells: [number, number][],
): Promise<(number | null)[]> {
  const out: (number | null)[] = new Array(cells.length).fill(null);
  if (cells.length === 0) return out;
  // ArcGIS multipoint is [x, y] = [lng, lat].
  const points = cells.map(([lat, lng]) => [lng, lat]);
  const body = new URLSearchParams({
    geometry: JSON.stringify({ points, spatialReference: { wkid: 4326 } }),
    geometryType: 'esriGeometryMultipoint',
    returnFirstValueOnly: 'true',
    f: 'json',
  });
  const res = await fetch(NCEI_SAMPLES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = (await res.json()) as {
    samples?: { locationId: number; value?: string | null }[];
  };
  for (const s of j.samples ?? []) {
    const v = s.value == null ? NaN : parseFloat(s.value);
    if (Number.isFinite(v) && s.locationId >= 0 && s.locationId < out.length) {
      out[s.locationId] = v;
    }
  }
  return out;
}
