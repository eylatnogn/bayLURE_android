# Data-source licensing notes

As of the July 2026 provider swap, bayLURE's core data comes from
**US-government APIs**: free, keyless, and **commercial use OK** — so running
ads or charging for the app does not violate any data-source terms. The
trade-off: coverage is **US only** (which matches the app's NOAA tides and
state-regulations features anyway). Status as of July 2026.

## Core sources — US government, commercial OK, no action needed

| Source | Used for |
|---|---|
| National Weather Service API (api.weather.gov) | weather, pressure, wind, sky, humidity, waves — `src/api/weather.ts` |
| NOAA CO-OPS | tide predictions (`tides.ts`) + measured water temperature (`marine.ts`) |
| NOAA Chart Display Service (WMS) | nautical-chart depth overlay on the map |
| NOAA NCEI DEM global mosaic | map depth shading, contour lines & pin depth readout (`src/api/depth.ts`) — ~3 m near US coasts, GEBCO-class offshore; public domain, commercial OK, sends CORS so it works on web too |
| USGS The National Map | topo map tiles (`src/components/mapHtml.ts`) |
| FCC Area API | point → US state for the regulations card (`geocode.ts`) |

Notes: NWS asks API users to identify themselves via User-Agent (set in
`weather.ts` — keep the contact email current). NWS forecast grids usually
ship an **empty pressure series** (pressure isn't a standard NDFD forecast
element), so pressure comes from the chain below.

## Pressure (special case)

| Source | Role | Policy |
|---|---|---|
| MET Norway Locationforecast (api.met.no) | Hourly sea-level pressure **forecast**, whole week (hourly ~3 days, 6-hourly to ~9) | Free, keyless, **CC BY 4.0 — commercial OK with attribution** (credited in the Guide tab). Requirements honored: identifying User-Agent, ≤4-decimal coords, one call per analysis (verified Jul 2026) |
| NWS observation stations | Live reading + real ~3h trend as fallback anchor | US gov, public domain |
| 29.92 standard atmosphere | Last-resort placeholder only | — |

## Remaining community sources — fine at launch scale

| Source | Used for | Policy | If the app gets big |
|---|---|---|---|
| OSM Nominatim | the address/ZIP search box only (US-biased) | Max 1 req/s, real user actions, attribution. Light app use is permitted; commercial apps aren't banned (unlike OSM's *tile* server, which the app no longer uses) | Move to a keyed geocoder (GeoNames free tier, MapTiler) |
| ~~Open-Topo-Data (GEBCO)~~ | — retired Jul 2026 — | Replaced by the NOAA NCEI DEM above: finer (~3 m vs 450 m on the coast), one call instead of rate-limited batches, and CORS-enabled so web works. Kept here only as a note in case a future non-US need arises | GPXZ / self-host GEBCO |
| Iowa Environmental Mesonet (IEM) | NEXRAD radar tiles + HRRR forecast-radar WMS on the map | University-hosted NOAA data (public domain); fair-use service, no commercial ban | NOAA nowCOAST WMS as fallback |
| iNaturalist API | "Expected fish nearby" | Attribution + rate limits; recheck terms at scale | Cache harder or drop |
| unpkg CDN | Leaflet + leaflet-velocity (MIT-licensed) inside the map document | Fine | Bundle locally to remove the CDN dependency |
| Fraunces font (OFL), Feather icons (MIT) | branding, icons | Commercial OK | — |

**Bottom line:** ads are clear to add — no paid data plans needed. The only
soft spots are polite-use policies on the search box (Nominatim) and depth
readouts (Open-Topo-Data), both trivial in volume and both swappable later
without touching the rest of the app.
