# bayLURE — Release notes

Store version: **v0.15.0** (matches the badge in the app header and
`src/version.ts`). This is the first public release.

---

## v0.15.0 — "What's new" for the store (paste-ready)

> The Play Console "What's new" field allows **500 characters max**. Use the
> short version below. (App Store Connect allows 4000, so either works there.)

### Short — Play "What's new" (≈460 chars)

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

### Set your spot — three ways
- **Use my location** — one tap to fetch GPS and drop you on the map.
- **Address or ZIP search** — type "32960" or "Lake Lanier, GA"; results are
  US-focused so a bare ZIP resolves to the right place.
- **Drop a pin** — tap or drag anywhere on an interactive topographic map to
  fish a spot you can see but can't name.
- **Save favorite spots** with your own labels (e.g. "North dock") and reload
  any of them in a tap.
- **Save presets** — store a whole setup (water type, species, clarity, depth,
  pressure, structure) as a named preset and re-apply it instantly.
- **Freshwater vs. saltwater** is auto-detected from how close the spot is to
  the coast, and you can override it any time.

### Fine-tune the read
Dial in the details so the picks and score match *your* water:
- **Water clarity** — clear, stained, or muddy.
- **Depth zone** — any, shallow, mid, or deep.
- **Fishing pressure** — light, moderate, or heavy (busier water = warier fish).
- **Target species** — pick one or more; the species list adapts to fresh or
  salt (bass, redfish, speckled trout, snook, flounder, striped bass, tarpon,
  Spanish mackerel, and more).
- **Structure & cover** — tag what's actually at your spot: grass flats,
  docks/pilings, jetty/rocks, oyster bars, mangroves, channel edge, inlet/pass,
  or open flats.

### Bite forecast
- A **0–100 bite score** for today or any of the next **6 days**.
- **Graded hour by hour** in a simple bar chart (night hours dimmed), so you
  can see the day's rhythm at a glance.
- **Best bite window** called out up top (e.g. "2 PM–11 PM · Excellent") — the
  feeding times that usually fall around dawn and dusk.
- Toggle between an **all-day** summary and any **single hour**; every reading
  on the screen updates to that moment.
- A **plain-English readout** explaining *why* the bite is strong or slow right
  now, and what to do about it.

### Live conditions at your spot
Everything that drives the bite, in one card:
- **Barometric pressure** with its trend arrow (rising/steady/falling) — the
  single biggest bite factor.
- **Air and water temperature** — water is measured from the nearest NOAA
  station when one is in range (it names the station and its distance), and
  estimated inland, clearly flagged either way.
- **Wind** speed, direction and gusts; **sky** and cloud cover; **humidity**.
- **Sunrise, sunset, and moon phase** (with illumination and major/minor days).
- **NOAA tide predictions** with the current movement and the next high/low
  time (saltwater).
- **Wave height** offshore and **charted water depth** where data exists.

### Interactive map
- A **USGS topographic** base map — contours and water that actually suit a
  fishing app.
- An **animated wind overlay** that flows across the map, **time-linked** to the
  hour you're viewing, with a color legend (0–30+ mph) and a wind-at-pin readout.
- An optional **depth view**: NOAA nautical charts (soundings and contours for
  US coasts and the Great Lakes) over depth shading, plus **tap-to-read** depth
  at any point.
- **Full-screen** map and drag-to-move pin.

### "Throw This" — a plan, not just a number
- **Ranked lures, rigs, and bait**, matched to your conditions, clarity, depth,
  target species, structure, and fishing pressure.
- Filter by **All / Lures / Rigs / Bait**; open any category for the **top ten
  with images and how-to-fish notes**.
- **Rod, line, and hook guidance** for the picks so you know how to rig them.
- A **read on what the fish are doing**, plus **playbooks for tough, pressured
  water** when the easy bite isn't there.

### Know your water
- **Expected fish nearby**, drawn from real reported sightings in your area.
- A **direct link to your state's official fishing regulations** — size, bag,
  and season limits.

### Catch log
- Log **species, gear (lure/rig/bait), size, notes, and a photo**.
- The **conditions attach automatically** to each catch, so over time you build
  your own record of exactly what was working.
- **Edit or delete** any entry — deletes ask for confirmation so nothing
  disappears on a mis-tap.
- Everything stays **on your device**; no account, nothing uploaded.

### Backup & restore
- **Export** your saved spots and presets to a backup file (share it, save it
  to Files or Drive, email it to yourself).
- **Import** it later to restore everything or move to a new phone — it merges
  in and skips duplicates, never overwriting what you already have.

### Built for the bank
- **Light and dark themes** (dark by default).
- A **beginner's guide**: an essentials checklist, comfort/safety/legal notes,
  a freshwater-vs-saltwater starter, and how to tie a simple first rig.
- **Free, no account, no sign-up** — supported by a single banner ad.

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

Bump the version in **two places** each release so the store and the in-app
badge stay in sync:
- `app.json` → `"version"`
- `src/version.ts` → `APP_VERSION`

Build numbers auto-increment on EAS; you only manage the version *name*.
