# bayLURE 🎣

**Read the conditions. Tie on the right thing.**

bayLURE is a cross-platform (iOS + Android) fishing app. Tell it your water type
and the cover you're fishing; it pulls live weather, water temperature, and —
for saltwater — NOAA tide predictions for your GPS location, then produces a
**bite forecast** and a ranked list of **lures, rigs, and bait** with the reason
behind each pick.

Built with **Expo / React Native (TypeScript)**.

**Look & feel:** a calm, natural palette (foliage greens, lake teal, sand),
soft card depth, a gradient header with a fish-over-waves logo mark, the
*Fraunces* display face for branding/headlines, and clean line icons
(`@expo/vector-icons`) — appealing but understated.

---

## What it does

1. **Location** — three ways to set your spot: tap **Use my location** for
   device GPS, type an **address or ZIP code** (geocoded via OpenStreetMap
   Nominatim, no key — great when location services are off), or **drop a pin**
   on an interactive map. The map is Leaflet + USGS topo tiles and works on web
   (iframe) and native (WebView). You can **save favorite spots with your own
   labels** ("Home lake", "North dock") and reload them with a tap.
   Structure & cover options are **filtered to the water type** — lily pads show
   only for freshwater; oyster bars and mangroves only for saltwater.
   A **target species** selector (largemouth, smallmouth, walleye, panfish,
   trout, catfish, pike / redfish, seatrout, snook, flounder, striper, tarpon,
   Spanish — or "Any") biases the lure ranking toward what that fish eats.
   A **fishing-pressure** selector (Light / Moderate / Heavy — separate from
   barometric pressure) scales the plan toward finesse for heavily-fished,
   educated water and adds a categorized playbook — see below.
   A **water-clarity** selector (Clear / Stained / Muddy) re-weights the lures
   (vibration/flash/scent for dirty water, natural/subtle for clear) and adds a
   clarity playbook of its own.
   After an analysis, an **Expected Fish Nearby** card lists the fish most
   reported around your spot (iNaturalist sightings); tap a 🎣 bayLURE-supported
   fish to set it as your target.
4. **Catch Log** — a second tab where you log each fish: pick the **species**
   and the **lure/rig/bait that caught it from a list** (never free text),
   add an optional size, notes, and photo. If you've run an analysis, the live
   **conditions snapshot** (water temp, pressure trend, wind, tide, bite score)
   is attached to the catch — seeding a dataset of what worked, and when.
   Everything is stored on-device.
2. **7-day forecast + hourly bite** — analyze today or any of the next 6 days.
   The outlook strip shows a bite score per day; tap a day for its full plan.
   Each day is also graded **hour by hour** with a bite chart and highlighted
   **best feeding windows** (peaks fall around dawn/dusk). **Conditions** gathered:
   - Air temperature, **barometric pressure + 3-hour trend** (the single biggest
     factor in fish activity), wind speed/direction/gusts, cloud cover, humidity,
     day/night, **sunrise/sunset**, and **moon phase** (major new/full feeding).
   - **Water temperature** — measured sea-surface temp for saltwater; an estimate
     from air temp for freshwater (clearly labeled).
   - **Tides** — nearest NOAA station's high/low predictions and whether the
     water is incoming, outgoing, or slack (saltwater only).
3. **Strategy** — a transparent, rule-based engine scores the bite 0–100 and
   maps it to a presentation "mood" (aggressive / neutral / finesse), then ranks
   the lure database against your structure, water temp, sky, tide, clarity,
   target species, and fishing pressure. It also explains **what the fish are
   doing** (a behavior read from the conditions) and gives clarity- and
   pressure-specific playbooks. Picks are shown **first**, right under the
   conditions, so the lures/rigs/bait — the point of the app — lead. A
   **Regulations & Limits** card links to the official state fishing-rules page
   for your location, and **Expected Fish Nearby** shows the top 5 with a
   tap-to-expand for the full list. Each pick also lists the **rod power/action,
   line (lb test), and hook size** to use, and you can **filter the picks by
   Lure / Rig / Bait** to see the top choices in each category.
6. **Guide tab** — a complete beginner equipment checklist (rod/reel, line,
   terminal tackle, lures, bait, tools, license, safety) for someone starting
   from nothing, plus freshwater vs. saltwater starter notes and a basic rig.
4. **Optional AI** — if you supply an Anthropic API key, it sends the same
   conditions to Claude for a conversational "guide's take." The app works fully
   without it.

## Data sources (all free, no API key)

| Data | Source |
| --- | --- |
| Weather, pressure, wind, clouds, waves | [National Weather Service forecast grid](https://www.weather.gov/documentation/services-web-api) |
| Measured water temperature | [NOAA CO-OPS water temperature stations](https://api.tidesandcurrents.noaa.gov/api/prod/) |
| Tide predictions | [NOAA CO-OPS Tides & Currents](https://api.tidesandcurrents.noaa.gov/api/prod/) |
| Map tiles | [USGS The National Map (topo)](https://basemap.nationalmap.gov/) |
| Address / ZIP geocoding | [OpenStreetMap Nominatim](https://nominatim.org/) (US-biased) |
| Point → US state (regulations) | [FCC Area API](https://geo.fcc.gov/api/census/) |
| Fish observed nearby | [iNaturalist species counts](https://api.inaturalist.org/v1/) |

> NWS/NOAA/USGS are US-government sources (commercial use OK) — so weather,
> tides, and the map cover the **US only**. Sunrise/sunset and moon phase are
> computed locally. Freshwater water temperature is **estimated** from air
> temperature and flagged as such in the UI.

## Project layout

```
App.tsx                    App shell
index.ts                   Expo entry point
src/
  types.ts                 Domain model (conditions, picks, strategy)
  theme.ts                 Colors / spacing tokens
  api/
    location.ts            GPS + reverse geocode (expo-location)
    geocode.ts             Address / ZIP -> coordinates (Nominatim); state via FCC
    areaSpecies.ts         Fish observed nearby (iNaturalist)
    weather.ts             NWS forecast grid + pressure trend
    marine.ts              Sea-surface temp / freshwater estimate
    tides.ts               Nearest NOAA station + hi/lo predictions
    conditions.ts          Orchestrates the three fetches
  engine/
    lureDatabase.ts        The knowledge base (lures, rigs, baits + tags)
    species.ts             Target-species list, labels, and tips
    pressure.ts            Fishing-pressure scaling + finesse playbook
    clarity.ts             Water-clarity scaling + clarity playbook
    behavior.ts            "What the fish are doing" read from conditions
    regulations.ts         State -> official fishing-regulation links
    gear.ts                Per-lure rod / line / hook recommendations
    strategy.ts            Bite-score model + lure ranking (rule-based)
    ai.ts                  Optional Claude enhancement layer
  storage/catchLog.ts      On-device catch log (AsyncStorage)
  components/
    MapPicker.tsx          Draggable-pin map (native WebView)
    MapPicker.web.tsx      Same map for web (iframe) — Metro auto-selects
    mapHtml.ts             Shared Leaflet/OSM document
    SpeciesPicker.tsx      Target-species chips
    StructurePicker.tsx    Water-type-aware cover chips
    LureSelect.tsx         Pick-from-list lure selector (catch log)
    AreaFishCard.tsx       Expected-fish-nearby list
    TabBar.tsx             Plan / Catch Log tabs
    ...                    Cards, toggles, sections
  screens/
    HomeScreen.tsx         Planner (5-step flow + 7-day outlook)
    CatchLogScreen.tsx     Log + browse catches
    HelpScreen.tsx         Beginner equipment guide
```

## Run it

Requires Node 18+ and the **Expo Go** app on your phone (App Store / Play Store).

```bash
npm install
npm start          # opens Expo Dev Tools + QR code
# scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

Or run on a simulator:

```bash
npm run ios        # macOS + Xcode
npm run android    # Android Studio emulator
npm run typecheck  # tsc --noEmit
```

## Deploying as a website (Vercel / Netlify)

This is primarily a native app, but `react-native-web` lets it also run as a
website. A `vercel.json` is included, so a Vercel deploy works out of the box:

- **Build command:** `expo export --platform web`
- **Output directory:** `dist`
- **Install command:** `npm install`

If Vercel ever shows a download prompt instead of the app, it means it served
the repo without running the web build — confirm the **Output Directory** is
set to `dist` (the included `vercel.json` does this automatically).

Build the static site locally to preview:

```bash
npm run build      # -> dist/  (open dist/index.html via a static server)
npx serve dist     # quick local preview
```

> The web build is great for demos and as an installable PWA. For real iPhone
> and Android apps, use Expo Go (development) and EAS Build (store-ready
> binaries) — see "Shipping to the App Store / Play Store" below.

## Shipping to the App Store / Play Store (EAS Build)

Vercel hosts websites, not native apps. To distribute actual iOS/Android apps,
use **EAS Build** (Expo's cloud build service). An `eas.json` with three build
profiles is already included:

| Profile | What it's for | Output |
| --- | --- | --- |
| `development` | Dev client for debugging on a device | internal install |
| `preview` | QA / TestFlight-style sharing | iOS simulator build + Android `.apk` |
| `production` | Store submission (auto-increments build number) | `.ipa` / `.aab` |

One-time setup:

```bash
npm install -g eas-cli
eas login                 # free Expo account
eas init                  # links the app & writes your projectId into app.json
```

Then build and submit (npm scripts wrap these):

```bash
npm run build:preview     # eas build --profile preview --platform all
npm run build:ios         # production iOS .ipa
npm run build:android     # production Android .aab
npm run submit:ios        # upload to App Store Connect
npm run submit:android    # upload to Google Play
```

You'll need paid developer accounts to publish (Apple Developer $99/yr, Google
Play one-time $25). EAS handles the signing credentials for you. For day-to-day
testing, `npm start` + the **Expo Go** app is fastest — no build required.

> Note: app icons and a splash image aren't included yet, so builds use Expo's
> defaults. Drop a 1024×1024 `icon.png` into `assets/` and reference it under
> `expo.icon` in `app.json` before a store release.

## Where the recommendations come from

Be clear-eyed about this: the recommendations are **not** pulled from a live
external service or a scientific dataset. They come from two things in this repo:

1. **A hand-authored knowledge base** (`src/engine/lureDatabase.ts`) — each
   lure/rig/bait is tagged with the water types, structure/cover, water-temp
   window, sky preference, presentation style, target species, and
   pressure-friendliness it's known for.
2. **A transparent rule engine** (`src/engine/strategy.ts` + `pressure.ts`) that
   scores conditions and ranks those baits using widely-held angling heuristics
   — barometric trends, water-temp activity bands, wind, light, tide, target
   species, and fishing pressure.

These heuristics encode common fishing wisdom (the kind in fishing literature,
guide tips, and tournament lore). They are **opinionated and not yet validated
against real catch data**, and the optional Claude layer is a language model, not
a data source. That's exactly why the **Catch Log** exists — logging real fish
and the lures that caught them is the first step toward tuning these weights
against what actually works on your water.

## How the bite score works

The engine starts at a neutral 50 and adjusts on well-known heuristics:

- **Pressure trend** — falling (pre-front) is the best feeding window; high &
  rising (post-front) is toughest.
- **Water temperature** — 60–80 °F is the prime activity band; cold water calls
  for slow/finesse, hot water pushes fish deep or to low light.
- **Wind** — a 5–15 mph chop is ideal; dead calm and gales both hurt. (Includes
  the old "wind from the east, fish bite the least" nudge.)
- **Sky & light** — overcast and dawn/dusk extend the feed; bright sun pins fish
  to cover.
- **Tide** — moving water feeds; slack water stalls.
- **Water depth** (Shallow / Mid / Deep) — favors baits that work that part of
  the column and adds a "where the fish are holding" note.
- **Water clarity** (Clear / Stained / Muddy) — re-weights the lure list
  (vibration, flash, dark/bright silhouettes, and scent for dirty water; natural,
  translucent, downsized baits for clear) and produces a clarity-specific
  playbook plus a behavior read (sight-feeding & spooky in clear water; lateral
  line & scent, tight to cover in muddy water).
- **Fishing pressure** (Light / Moderate / Heavy) — scales the whole plan: the
  bite score drops, the mood shifts toward finesse (Moderate = one notch, Heavy
  = straight to finesse), subtle/natural baits (Ned, drop-shot, wacky, live
  bait, light jigheads) get boosted while loud reaction baits get buried, and a
  categorized **Pressured-Water Playbook** (downsize, color, line/leader,
  cadence, position, timing, bailout baits) is added — with extra measures at
  the Heavy level.

The resulting mood (aggressive / neutral / finesse) decides whether moving
reaction baits or subtle finesse presentations get ranked first. Each pick is
then matched against your reported structure, the water-temp window, and sky.

> It's guidance, not gospel. Local knowledge and regulations always win.

## Enabling the optional AI layer

`src/engine/ai.ts` posts conditions to the Claude API. For a real release,
**proxy the call through your own backend** rather than shipping an API key in
the app. The current direct path is for prototyping only and is off until a key
is provided.

## Roadmap ideas

- Saved spots & history (catch log tied to conditions)
- Species selector to bias the lure ranking
- Solunar (major/minor) feeding times
- Hourly forecast so you can pick the best window of the day
- Wind/temp units toggle (metric)

---

_bayLURE — tight lines._

---

## Store release

This folder is the store-release copy (Expo SDK 56, v1.0.0, bundle ID
`com.baylure.app`). Start with **[SUBMISSION_GUIDE.md](SUBMISSION_GUIDE.md)**;
listing copy is in [STORE_LISTING.md](STORE_LISTING.md), the hostable policy in
[PRIVACY_POLICY.md](PRIVACY_POLICY.md), and data-source terms in
[API_LICENSING.md](API_LICENSING.md). Icons/splash live in `assets/`, Play
listing art in `store-assets/`.
