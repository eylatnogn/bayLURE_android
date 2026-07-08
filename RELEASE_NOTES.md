# bayLURE — Release notes

## v1.0.0 — "What's new" for the store (paste-ready)

> The Play Console "What's new" field allows **500 characters max**. Use the
> short version below. (App Store Connect allows 4000, so either works there.)

### Short — Play "What's new" (≈430 chars)

```
Welcome to bayLURE! Tell us your fishing spot and we turn live conditions into a 0–100 bite forecast — graded hour by hour — plus ranked lures, rigs, and bait for what's biting.

• Weather, pressure, wind, water temp, tides & moon phase
• Topo map with a live wind overlay
• Best bite times for today and the next 6 days
• Catch log that remembers your conditions
• Nearby species + your state's fishing rules

Free. No account. Everything stays on your phone.
```

### Even shorter (≈150 chars, if you prefer minimal)

```
First release! Set your spot, get a 0–100 bite forecast and ranked lure/rig/bait picks, check tides and best bite times, and log your catches. Free.
```

---

## Full feature list (for your reference + the store description)

**Set your spot**
- Use GPS, type an address or ZIP, or drop a pin on a topographic map
- Save favorite spots with your own labels and reload them in a tap
- Save full setups as reusable presets
- Freshwater or saltwater, auto-detected from the spot (tap to override)

**Bite forecast**
- A 0–100 bite score for today or any of the next 6 days
- Graded hour by hour, with the best bite windows highlighted
- Plain-English readout of why the bite is good or slow right now

**Live conditions**
- Barometric pressure and its trend (the biggest bite factor)
- Air and water temperature (water measured from the nearest NOAA station,
  estimated inland)
- Wind speed, direction and gusts; sky, cloud cover and humidity
- Sunrise, sunset and moon phase
- NOAA tide predictions with the current movement (saltwater)
- Waves offshore, and charted water depth where available

**Interactive map**
- USGS topographic base map
- Animated wind overlay, time-linked to the hour you're viewing
- Optional depth view with NOAA nautical charts and depth shading
- Tap the map to read the charted depth at any point

**A plan, not just a number — "Throw This"**
- Ranked lures, rigs and bait matched to your conditions, water clarity,
  depth, target species, structure and fishing pressure
- Top picks for each type with how-to-fish notes and rod/line/hook guidance
- A read on what the fish are doing, plus playbooks for tough, pressured water

**Know your water**
- Expected fish nearby, from real reported sightings
- A direct link to your state's official fishing regulations

**Catch log**
- Log species, gear, size, notes and a photo
- Conditions attach to each catch automatically — build your own record of
  what works
- Everything stays on your device; edit or delete any entry (with confirm)

**Backup & restore**
- Export your saved spots and presets to a file, import them on a new phone

**Built for the bank**
- Light and dark themes
- A beginner's gear-and-technique guide, from nothing to a first rig
- Free, no account, no sign-up — supported by a single banner ad

---

## Template for future updates

Keep each release's "What's new" short and specific — what changed, not the
whole feature list. Example:

```
• Added [feature]
• [Species/region] picks are now sharper
• Fixed [bug] and improved [screen] performance
Thanks for the feedback — keep it coming!
```

Bump `"version"` in `app.json` each release (1.0.0 → 1.1.0). Build numbers
auto-increment on EAS.
