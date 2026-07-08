# Data-source licensing notes

bayLURE calls free, keyless public APIs. For a **free, ad-free app** at
hobby/indie scale this is broadly fine, but the terms differ — and two of
them bite if the app ever monetizes or gets big. Status as of July 2026;
recheck terms before adding ads or paid features.

| Source | Used for | Free-app status | If you add ads / get big |
|---|---|---|---|
| Open-Meteo | weather, marine, hourly | **Non-commercial use only** on the free tier. A free, ad-free app is generally within this; confirm against their current terms. | Ads/IAP make the app commercial → paid plan (~€29/mo) or switch provider |
| OpenStreetMap tiles (`tile.openstreetmap.org`) | map base layer in `src/components/mapHtml.ts` | Tolerated at low volume; policy discourages distributed apps | Swap to MapTiler/Stadia/Protomaps (free tiers with key) — one URL change in `mapHtml.ts` |
| OSM Nominatim | address/ZIP geocoding | OK: max 1 req/s, real user actions only | Same policy; heavy use → hosted geocoder |
| NOAA CO-OPS (tides) + Chart Display WMS | tides, chart overlay | US-government data, **commercial use OK** | No change needed |
| Open-Topo-Data (GEBCO) | water depth | Public instance is fair-use | Self-host (open source) or cache more aggressively |
| iNaturalist API | fish reported nearby | OK with attribution, rate limits | Recheck terms |
| unpkg CDN (Leaflet, leaflet-velocity) | map libraries inside the WebView | Fine | Consider bundling locally so the map doesn't depend on a CDN |
| Fraunces font (OFL) / Feather icons (MIT) | branding, icons | Commercial OK | No change needed |

**Bottom line:** ship v1 free with no ads and nothing blocks you. Before
monetizing, budget for an Open-Meteo commercial plan (or a provider switch)
and move map tiles off the OSM public server. Both changes are isolated —
`src/api/*.ts` for data, `src/components/mapHtml.ts` for tiles.
