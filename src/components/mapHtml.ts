import type { Coordinates } from '@/types';

export interface MapPickerProps {
  /** Where to center the map / place the initial pin. */
  center: Coordinates | null;
  /** Called whenever the user drops or drags the pin. */
  onPick: (coords: Coordinates) => void;
}

/** Sensible fallback when we have no location yet (continental US). */
export const DEFAULT_CENTER: Coordinates = {
  latitude: 39.5,
  longitude: -98.35,
};

/**
 * A self-contained Leaflet + OpenStreetMap document with a draggable pin and an
 * animated wind overlay (leaflet-velocity). No API key required.
 *
 * The pin posts the selected coordinates back to its host:
 * `window.ReactNativeWebView` on native, the parent window on web.
 *
 * The wind layer samples a coarse grid of Open-Meteo surface wind over the
 * current view, converts speed+direction to U/V components, and animates the
 * flow. It is best-effort: any failure (offline, rate limit) is swallowed so
 * the map still works as a plain spot-picker.
 *
 * The same HTML drives both the native WebView and the web <iframe>.
 */
export function buildMapHtml(center: Coordinates | null): string {
  const c = center ?? DEFAULT_CENTER;
  const zoom = center ? 12 : 4;
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
    .legend-title { font-weight: 700; margin-bottom: 4px; }
    .legend-bar {
      height: 8px; border-radius: 4px;
      background: linear-gradient(to right,
        #5b8f8a, #3a7d52, #6f9e3f, #c0a233, #c08433, #b15240);
    }
    .legend-scale { display: flex; justify-content: space-between; margin-top: 3px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Tap the map or drag the pin to set your spot</div>
  <div class="legend" id="legend">
    <div class="legend-title">Wind speed (mph)</div>
    <div class="legend-bar"></div>
    <div class="legend-scale"><span>0</span><span>15</span><span>30+</span></div>
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
    var GRID = 8;           // GRID x GRID sample points over the view
    var windLayer = null;
    var windTimer = null;

    // Meteorological wind direction is the bearing the wind blows FROM, so the
    // motion vector is the negative: u east-ward, v north-ward, both m/s.
    function toUV(speed, dirDeg) {
      var r = dirDeg * Math.PI / 180;
      return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) };
    }

    function buildVelocity(nx, ny, north, south, west, east, results) {
      var dx = nx > 1 ? (east - west) / (nx - 1) : 0;
      var dy = ny > 1 ? (north - south) / (ny - 1) : 0;
      var ref = new Date().toISOString();
      var u = new Array(nx * ny), v = new Array(nx * ny);
      for (var i = 0; i < nx * ny; i++) {
        var cur = results[i] && results[i].current ? results[i].current : null;
        var spd = cur && cur.wind_speed_10m != null ? cur.wind_speed_10m : 0;
        var dir = cur && cur.wind_direction_10m != null ? cur.wind_direction_10m : 0;
        var comp = toUV(spd, dir);
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

    function refreshWind() {
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
        var url = 'https://api.open-meteo.com/v1/forecast'
          + '?latitude=' + lats.join(',')
          + '&longitude=' + lons.join(',')
          + '&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms';
        fetch(url)
          .then(function (res) { return res.json(); })
          .then(function (json) {
            var results = Array.isArray(json) ? json : [json];
            var data = buildVelocity(nx, ny, north, south, west, east, results);
            var lg = document.getElementById('legend');
            if (lg) { lg.style.display = 'block'; }
            if (windLayer) { windLayer.setData(data); return; }
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

    map.whenReady(function () { refreshWind(); });
    map.on('moveend', scheduleWind);
  </script>
</body>
</html>`;
}
