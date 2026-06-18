# BALURE 🎣

**Read the conditions. Tie on the right thing.**

BALURE is a cross-platform (iOS + Android) fishing app. Tell it your water type
and the cover you're fishing; it pulls live weather, water temperature, and —
for saltwater — NOAA tide predictions for your GPS location, then produces a
**bite forecast** and a ranked list of **lures, rigs, and bait** with the reason
behind each pick.

Built with **Expo / React Native (TypeScript)**.

---

## What it does

1. **Location** — tap **Use my location** for device GPS, or **drop a pin** on
   an interactive map to fish a spot you're not standing on. The map is Leaflet
   + OpenStreetMap (no API key) and works on web (iframe) and native (WebView).
   Structure & cover options are **filtered to the water type** — lily pads show
   only for freshwater; oyster bars and mangroves only for saltwater.
   A **target species** selector (largemouth, smallmouth, walleye, panfish,
   trout, catfish, pike / redfish, seatrout, snook, flounder, striper, tarpon,
   Spanish — or "Any") biases the lure ranking toward what that fish eats.
2. **Conditions** — gathers everything the strategy needs:
   - Air temperature, **barometric pressure + 3-hour trend** (the single biggest
     factor in fish activity), wind speed/direction/gusts, cloud cover, humidity,
     day/night.
   - **Water temperature** — measured sea-surface temp for saltwater; an estimate
     from air temp for freshwater (clearly labeled).
   - **Tides** — nearest NOAA station's high/low predictions and whether the
     water is incoming, outgoing, or slack (saltwater only).
3. **Strategy** — a transparent, rule-based engine scores the bite 0–100 and
   maps it to a presentation "mood" (aggressive / neutral / finesse), then ranks
   the lure database against your structure, water temp, sky, and tide.
4. **Optional AI** — if you supply an Anthropic API key, it sends the same
   conditions to Claude for a conversational "guide's take." The app works fully
   without it.

## Data sources (all free, no API key)

| Data | Source |
| --- | --- |
| Weather, pressure, wind, clouds | [Open-Meteo Forecast API](https://open-meteo.com/) |
| Sea-surface temp, wave height | [Open-Meteo Marine API](https://open-meteo.com/en/docs/marine-weather-api) |
| Tide predictions | [NOAA CO-OPS Tides & Currents](https://api.tidesandcurrents.noaa.gov/api/prod/) |

> NOAA tides cover U.S. coastal waters. Open-Meteo is global. Freshwater water
> temperature is **estimated** from air temperature and flagged as such in the UI.

## Project layout

```
App.tsx                    App shell
index.ts                   Expo entry point
src/
  types.ts                 Domain model (conditions, picks, strategy)
  theme.ts                 Colors / spacing tokens
  api/
    location.ts            GPS + reverse geocode (expo-location)
    weather.ts             Open-Meteo weather + pressure trend
    marine.ts              Sea-surface temp / freshwater estimate
    tides.ts               Nearest NOAA station + hi/lo predictions
    conditions.ts          Orchestrates the three fetches
  engine/
    lureDatabase.ts        The knowledge base (lures, rigs, baits + tags)
    species.ts             Target-species list, labels, and tips
    strategy.ts            Bite-score model + lure ranking (rule-based)
    ai.ts                  Optional Claude enhancement layer
  components/
    MapPicker.tsx          Draggable-pin map (native WebView)
    MapPicker.web.tsx      Same map for web (iframe) — Metro auto-selects
    mapHtml.ts             Shared Leaflet/OSM document
    SpeciesPicker.tsx      Target-species chips
    StructurePicker.tsx    Water-type-aware cover chips
    ...                    Cards, toggles, sections
  screens/HomeScreen.tsx   Main screen (4-step flow)
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

_BALURE — tight lines._
