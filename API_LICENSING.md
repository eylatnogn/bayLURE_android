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
| USGS The National Map | topo map tiles (`src/components/mapHtml.ts`) |
| FCC Area API | point → US state for the regulations card (`geocode.ts`) |

Notes: NWS asks API users to identify themselves via User-Agent (set in
`weather.ts` — keep the contact email current). Pressure forecasts only extend
~3 days; further out the app carries the last value with a "steady" trend.

## Remaining community sources — fine at launch scale

| Source | Used for | Policy | If the app gets big |
|---|---|---|---|
| OSM Nominatim | the address/ZIP search box only (US-biased) | Max 1 req/s, real user actions, attribution. Light app use is permitted; commercial apps aren't banned (unlike OSM's *tile* server, which the app no longer uses) | Move to a keyed geocoder (GeoNames free tier, MapTiler) |
| Open-Topo-Data (GEBCO) | charted-depth readouts + map depth shading | Public instance is fair-use (~1 req/s). Note: its API blocks browser (CORS) requests, so depth features are native-only; the app degrades gracefully on web | Self-host (open source) |
| iNaturalist API | "Expected fish nearby" | Attribution + rate limits; recheck terms at scale | Cache harder or drop |
| unpkg CDN | Leaflet + leaflet-velocity (MIT-licensed) inside the map document | Fine | Bundle locally to remove the CDN dependency |
| Fraunces font (OFL), Feather icons (MIT) | branding, icons | Commercial OK | — |

**Bottom line:** ads are clear to add — no paid data plans needed. The only
soft spots are polite-use policies on the search box (Nominatim) and depth
readouts (Open-Topo-Data), both trivial in volume and both swappable later
without touching the rest of the app.
