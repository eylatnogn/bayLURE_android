import type { Coordinates } from '@/types';

export interface MapPickerProps {
  /** Where to center the map / place the initial pin. */
  center: Coordinates | null;
  /** Called whenever the user drops or drags the pin. */
  onPick: (coords: Coordinates) => void;
  /**
   * Local ISO hour the wind overlay should show (e.g. "2026-06-22T14:00").
   * Null shows live "current" wind. Comes from the Conditions hour/day picker.
   */
  windTargetISO?: string | null;
  /** Human label for that time, shown on the map (e.g. "Sat 2 PM" or "Now"). */
  windTargetLabel?: string;
}

/** Sensible fallback when we have no location yet (continental US). */
export const DEFAULT_CENTER: Coordinates = {
  latitude: 39.5,
  longitude: -98.35,
};

/** Minimal HTML-escape for the few label characters that could matter. */
function esc(s: string): string {
  return s.replace(/[<>&"]/g, (ch) =>
    ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : '&quot;',
  );
}

/**
 * A self-contained Leaflet + OpenStreetMap document with a draggable pin and an
 * animated wind overlay (leaflet-velocity). No API key required.
 *
 * The pin posts the selected coordinates back to its host:
 * `window.ReactNativeWebView` on native, the parent window on web.
 *
 * The wind layer samples a coarse grid of Open-Meteo wind over the current
 * view, converts speed+direction to U/V components, and animates the flow. It
 * shows the hour given by `windTargetISO` (from the Conditions picker), or live
 * "current" wind when that is null. The on-map legend states which time it is
 * for. Best-effort: any failure (offline, rate limit) is swallowed so the map
 * still works as a plain spot-picker.
 *
 * The same HTML drives both the native WebView and the web <iframe>.
 */
export function buildMapHtml(
  center: Coordinates | null,
  windTargetISO: string | null = null,
  windTargetLabel = 'Now',
): string {
  const c = center ?? DEFAULT_CENTER;
  const zoom = center ? 12 : 4;
  const isoLiteral = windTargetISO ? JSON.stringify(windTargetISO) : 'null';
  const whenText = esc(`Wind · ${windTargetLabel}`);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet-velocity@2.1.4/dist/leaflet-velocity.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .hint {
      position: absolute; z-index: 1000; left: 8px; top: 8px;
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
    .leaflet-velocity-control { font: 11px -apple-system, Roboto, sans-serif; }
    .legend {
      position: absolute; z-index: 1000; right: 8px; bottom: 22px; display: none;
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 11px -apple-system, Roboto, sans-serif;
      padding: 6px 8px; border-radius: 8px; width: 132px;
    }
    .legend-when { font-weight: 700; margin-bottom: 4px; }
    .legend-bar {
      height: 8px; border-radius: 4px;
      background: linear-gradient(to right,
        #5b8f8a, #3a7d52, #6f9e3f, #c0a233, #c08433, #b15240);
    }
    .legend-scale { display: flex; justify-content: space-between; margin-top: 3px; }
    .windtoggle {
      position: absolute; z-index: 1000; right: 8px; top: 8px; border: none;
      background: #3a7d52; color: #f7faf3; cursor: pointer;
      font: 600 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
    .windtoggle.off { background: rgba(34,46,28,0.82); color: #cdd8c4; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Tap or drag to set your spot</div>
  <button class="windtoggle" id="windtoggle">Wind: on</button>
  <div class="legend" id="legend">
    <div class="legend-when">${whenText}</div>
    <div class="legend-bar"></div>
    <div class="legend-scale"><span>0</span><span>15</span><span>30+ mph</span></div>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-velocity@2.1.4/dist/leaflet-velocity.js"></script>
  <script>
    var map = L.map('map').setView([${c.latitude}, ${c.longitude}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    var marker = L.marker([${c.latitude}, ${c.longitude}], { draggable: true }).addTo(map);
    function send(ll) {
      var msg = JSON.stringify({ latitude: ll.lat, longitude: ll.lng });
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
      else if (window.parent) { window.parent.postMessage(msg, '*'); }
    }
    marker.on('dragend', function () { send(marker.getLatLng()); });
    map.on('click', function (e) { marker.setLatLng(e.latlng); send(e.latlng); });

    // ---- Animated wind overlay (leaflet-velocity) ----
    // The hour to show, baked in from the Conditions picker. null = current.
    var windTargetISO = ${isoLiteral};
    var GRID = 8;           // GRID x GRID sample points over the view
    var windLayer = null;
    var windTimer = null;
    var windEnabled = true; // toggled by the on-map Wind button

    // Meteorological wind direction is the bearing the wind blows FROM, so the
    // motion vector is the negative: u east-ward, v north-ward, both m/s.
    function toUV(speed, dirDeg) {
      var r = dirDeg * Math.PI / 180;
      return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) };
    }

    function buildVelocity(nx, ny, north, south, west, east, samples) {
      var dx = nx > 1 ? (east - west) / (nx - 1) : 0;
      var dy = ny > 1 ? (north - south) / (ny - 1) : 0;
      var ref = new Date().toISOString();
      var u = new Array(nx * ny), v = new Array(nx * ny);
      for (var i = 0; i < nx * ny; i++) {
        var s = samples[i] || { speed: 0, dir: 0 };
        var comp = toUV(s.speed, s.dir);
        u[i] = comp.u; v[i] = comp.v;
      }
      function header(num, name) {
        return {
          parameterUnit: 'm.s-1', parameterCategory: 2,
          parameterNumber: num, parameterNumberName: name,
          nx: nx, ny: ny,
          lo1: west, la1: north, lo2: east, la2: south,
          dx: dx, dy: dy, refTime: ref
        };
      }
      return [
        { header: header(2, 'eastward_wind'), data: u },
        { header: header(3, 'northward_wind'), data: v }
      ];
    }

    function nearestTimeIndex(times, iso) {
      var target = new Date(iso).getTime();
      var best = -1, bestDiff = Infinity;
      for (var i = 0; i < times.length; i++) {
        var d = Math.abs(new Date(times[i]).getTime() - target);
        if (d < bestDiff) { bestDiff = d; best = i; }
      }
      return best;
    }

    // Pull one {speed,dir} per grid point. Hourly mode picks the target hour
    // (matched once from the first point's time axis); else uses live current.
    function extractSamples(results) {
      var idx = -1;
      if (windTargetISO && results[0] && results[0].hourly && results[0].hourly.time) {
        var times = results[0].hourly.time;
        idx = times.indexOf(windTargetISO);
        if (idx < 0) { idx = nearestTimeIndex(times, windTargetISO); }
      }
      var out = [];
      for (var i = 0; i < results.length; i++) {
        var r = results[i], spd = 0, dir = 0;
        if (windTargetISO && r && r.hourly && idx >= 0) {
          spd = r.hourly.wind_speed_10m[idx];
          dir = r.hourly.wind_direction_10m[idx];
        } else if (r && r.current) {
          spd = r.current.wind_speed_10m;
          dir = r.current.wind_direction_10m;
        }
        out.push({ speed: spd == null ? 0 : spd, dir: dir == null ? 0 : dir });
      }
      return out;
    }

    function refreshWind() {
      if (!windEnabled) { return; }
      try {
        var b = map.getBounds();
        var north = b.getNorth(), south = b.getSouth();
        var west = b.getWest(), east = b.getEast();
        // Clamp a very wide (zoomed-out) view so the grid stays meaningful.
        if (east - west > 50) { var mx = (east + west) / 2; west = mx - 25; east = mx + 25; }
        if (north - south > 50) { var my = (north + south) / 2; south = my - 25; north = my + 25; }
        var nx = GRID, ny = GRID;
        var dx = (east - west) / (nx - 1), dy = (north - south) / (ny - 1);
        var lats = [], lons = [];
        // Row-major, north-to-south then west-to-east, to match the header.
        for (var row = 0; row < ny; row++) {
          var lat = north - row * dy;
          for (var col = 0; col < nx; col++) {
            lats.push(Math.round(lat * 1e4) / 1e4);
            lons.push(Math.round((west + col * dx) * 1e4) / 1e4);
          }
        }
        var base = 'https://api.open-meteo.com/v1/forecast'
          + '?latitude=' + lats.join(',')
          + '&longitude=' + lons.join(',')
          + '&wind_speed_unit=ms';
        var url = windTargetISO
          ? base + '&hourly=wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=8'
          : base + '&current=wind_speed_10m,wind_direction_10m';
        fetch(url)
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (!windEnabled) { return; }
            var results = Array.isArray(json) ? json : [json];
            var samples = extractSamples(results);
            var data = buildVelocity(nx, ny, north, south, west, east, samples);
            var lg = document.getElementById('legend');
            if (lg) { lg.style.display = 'block'; }
            if (windLayer) {
              windLayer.setData(data);
              if (!map.hasLayer(windLayer)) { windLayer.addTo(map); }
              return;
            }
            windLayer = L.velocityLayer({
              displayValues: true,
              displayOptions: {
                velocityType: 'Wind', position: 'bottomleft',
                emptyString: 'No wind data', angleConvention: 'bearingCW',
                showCardinal: true, speedUnit: 'mph'
              },
              data: data,
              // Color scale spans 0–30 mph (13.41 m/s); see the on-map legend.
              minVelocity: 0, maxVelocity: 13.41,
              velocityScale: 0.01, opacity: 0.85,
              colorScale: ['#5b8f8a', '#3a7d52', '#6f9e3f', '#c0a233', '#c08433', '#b15240']
            });
            windLayer.addTo(map);
          })
          .catch(function () { /* wind is optional */ });
      } catch (e) { /* wind is optional */ }
    }

    function scheduleWind() {
      if (windTimer) { clearTimeout(windTimer); }
      windTimer = setTimeout(refreshWind, 700);
    }

    // Wind on/off toggle. disableClickPropagation keeps a button tap from
    // also dropping the spot pin on the map underneath.
    var toggleBtn = document.getElementById('windtoggle');
    if (L.DomEvent) {
      L.DomEvent.disableClickPropagation(toggleBtn);
      L.DomEvent.disableScrollPropagation(toggleBtn);
    }
    toggleBtn.addEventListener('click', function () {
      windEnabled = !windEnabled;
      var lg = document.getElementById('legend');
      if (windEnabled) {
        toggleBtn.textContent = 'Wind: on';
        toggleBtn.classList.remove('off');
        refreshWind(); // re-fetches for the current view, re-adds the layer, shows the legend
      } else {
        toggleBtn.textContent = 'Wind: off';
        toggleBtn.classList.add('off');
        if (windLayer) { map.removeLayer(windLayer); }
        if (lg) { lg.style.display = 'none'; }
      }
    });

    map.whenReady(function () { refreshWind(); });
    map.on('moveend', scheduleWind);
  </script>
</body>
</html>`;
}
