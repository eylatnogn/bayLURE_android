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

1. **Location** — uses your device GPS (with reverse-geocoded place name).
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
    strategy.ts            Bite-score model + lure ranking (rule-based)
    ai.ts                  Optional Claude enhancement layer
  components/              Reusable UI (cards, pickers, toggles)
  screens/HomeScreen.tsx   Main screen
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
