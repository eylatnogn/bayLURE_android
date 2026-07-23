# Changelog

All notable changes to bayLURE. Dates are release/build dates.

## Unreleased (after v0.90.0)
- **Pick your graph metric** — the Tides & Bite chart remembers which curve
  you prefer (tide, air, rain, wind, pressure, cloud, or the new humidity
  option) and opens on it every time. Spots without tide data (freshwater,
  or a NOAA outage) fill the chart with your last-chosen metric instead of
  defaulting to air.
- **Customize the stat tiles** — the move icon next to the tiles opens the
  same drag-to-reorder mode as the main conditions strip: drag tiles into
  your order, ✕ removes them (at least one always stays), and removed ones
  come back from "Add a tile" chips. If you remove the tile whose curve is
  showing, the chart hops to your first tile. All of it persists.

## v0.90.0 — 2026-07-22
- **Smarter bite score** — species-specific water-temperature windows,
  seasonal behavior phase (pre-spawn/spawn/fall feed-up), moon phase and
  solunar major/minor feeding windows in the hourly curve, a personal bias
  learned from your own condition-tagged catches, and USGS river-flow data
  for river spots.
- **Map remembers your overlays** — Wind, Depth, Contour, Sat, and Radar
  choices persist, so the map opens exactly how you left it (full screen
  inherits satellite/wind now too).
- **Map reliability** — failed chart/base tiles retry automatically (no
  more random satellite squares punched through the nautical chart), and
  the expand + re-center buttons are bigger.
- **Live-data outage notice** — if a source (NOAA tides, water temp, depth)
  is down, a calm banner says which readings are estimated or missing and
  that it's the provider's outage, not your connection; tide fetches retry
  through NOAA brownouts. Charted depth moved to NOAA NCEI (~3 m coastal
  resolution, no rate limits).
- **Quick Start cleanup** — the built-in starter presets can be deleted
  (two-step confirm), and the choice sticks.
- Jump button lands on the bite score even with the Location/Adjust panels
  expanded.
- **Rain & lightning** — the conditions grid shows chance of rain for the
  selected day/hour, and a warning banner calls out forecast thunderstorm
  hours ("lightning and open water don't mix"). Data from the NWS
  categorical weather grid.
- **Re-center zoom** — the map's re-center button now always lands at zoom
  14: close to the pin with the surrounding water still in view.
- **Tides & Bite graph** — "Tides & bite graph" button on the Forecast card
  (saltwater spots) opens an hourly chart: NOAA tide-height curve with
  high/low markers over the day's bite-score bars, fish icons on prime
  hours, and a "now" cursor. Follows the selected forecast day. Peak hours
  stand out: a "★ Peak bite · 5 AM" callout, gold highlight bands, and the
  score shown on the day's best hours (lesser hours get smaller markers).
  The sheet is a full planner: pick any day inside it, tap an hour on the
  chart to see that moment's weather (air, rain/storms, wind, pressure,
  sky, tide state), and the map scrolls into view above the sheet. The map
  stays fully interactive while the sheet is open (it floats, no modal),
  the sheet is wider, and all text sizes were raised for readability.
  Opening the sheet now shows the FULL map above it (the sheet is compact
  enough to fit both without scrolling), a centered grab handle drags the
  sheet taller/shorter and locks where you leave it, the sheet sits on a
  darker background so it reads as its own layer, fonts are uniform, and
  the legend fits one row.
- **Map rotation** — two-finger twist (touch), shift+drag (desktop), and a
  compass control that resets north.
- After the first analysis, "Fine-tune your read" auto-collapses so the
  forecast is front and center; the floating jump button now hops between
  the map and the Pick-a-day forecast only, measured fresh so collapsed
  sections can't throw off its target.
- Ad banner no longer holds blank space when no ad is served; Pro stays
  fully bannerless.
- Fixed a native "index is not in the allowed range" error when attaching
  a photo to a catch; failed resizes now fall back to the original photo.

## v0.15.2 — 2026-07-10

### Plan tab
- **Satellite map** — USGS aerial imagery (with road/place labels) is now the
  default base layer; the `Sat` chip toggles back to the classic topo map.
- **Re-center button** — crosshair control snaps the map back to your pin.
- **Offshore species** — Mahi-Mahi, King Mackerel, Cobia, Grouper, Snapper,
  Amberjack, Tuna, and Wahoo join the target list, each with targeting tips.
- **Species search** — the six most popular fish stay as one-tap chips;
  everything else is a search away.
- **"Where they hold"** — selected species show whether they typically hold
  top water, mid-column, or near bottom.
- **Offshore lures** — vertical/slow-pitch jigs, high-speed trolling spoons,
  and live baitfish added to the recommendation engine.
- **Last spot restored** — the app reopens on the last location you viewed
  and re-runs the analysis automatically.

### Catch Log tab
- **Your Patterns** — bayLURE mines your condition-tagged catches for the
  pressure trend, sky, wind, water temperature, time of day, tide, and
  clarity you actually catch fish in — and flags upcoming forecast days that
  match ("Days ahead that fish like your catches").
- **Backdating** — edit the catch date (and the attached location label) to
  log fish from earlier days accurately.
- **Search-to-log** — species and gear are picked from a search box (across
  all lures, rigs, and bait), or type anything and keep it as a custom entry.
- **Backup v2** — export/import now includes the catch log (conditions and
  all), alongside saved spots and presets.

### General
- bayLURE Pro groundwork: paywall, free-tier limits (dormant until billing
  ships), and redeem-code unlock. Subscriptions marked "coming soon".
- Guide tab gained bayLURE Pro and updated Backup & Restore sections.

## v0.15.1 — 2026-07-09
- bayLURE Pro scaffolding with restore-purchases entry in the Guide tab.
- Redeem codes (hash-verified, revocable) for promotional Pro unlocks.

## v0.15.0 — 2026-07-08
- AdMob banner (production builds only; test ads in dev/preview).
- Full data-source swap to US-government APIs (NWS weather, NOAA CO-OPS water
  temperature/tides, USGS map tiles, FCC state lookup) — commercially clear.
- Backup & Restore (spots + presets) in the Guide tab.
- Catch log edit/delete with two-step confirm; map drag fix on Android;
  Expo SDK 56 / Play-ready packaging.
