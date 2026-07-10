# Changelog

All notable changes to bayLURE. Dates are release/build dates.

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
