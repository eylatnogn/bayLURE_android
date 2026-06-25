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
 * A self-contained Leaflet + OpenStreetMap document with a draggable pin, an
 * animated wind overlay (leaflet-velocity), and an optional depth view. No API
 * key required.
 *
 * The pin posts the selected coordinates back to its host:
 * `window.ReactNativeWebView` on native, the parent window on web.
 *
 * Wind: samples a coarse grid of Open-Meteo wind over the view and animates the
 * flow for the hour given by `windTargetISO` (or live "current" when null).
 *
 * Depth (toggle, off by default): NOAA nautical charts (real soundings/contours,
 * US coastal + Great Lakes) over a coarse GEBCO depth shading; tapping the pin
 * reads the GEBCO depth at that point. All best-effort — failures are swallowed
 * so the map still works as a plain spot-picker.
 *
 * The same HTML drives both the native WebView and the web <iframe>.
 */
export function buildMapHtml(
  center: Coordinates | null,
  windTargetISO: string | null = null,
  windTargetLabel = 'Now',
  fullscreen = false,
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
    /* Stop iOS from flashing a tap highlight / selecting text on every tap,
       which otherwise makes the map feel stuck. The pin still drops normally. */
    * { -webkit-tap-highlight-color: transparent; }
    html, body {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    }
    /* Move the +/- zoom control to the vertical middle of the left edge. */
    .leaflet-top.leaflet-left { top: 50%; transform: translateY(-50%); }
    .hint {
      position: absolute; z-index: 1000; left: 50%; top: 8px; transform: translateX(-50%);
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px; white-space: nowrap;
    }
    .maptoggle {
      position: absolute; z-index: 1000; right: 8px; border: none;
      background: #3a7d52; color: #f7faf3; cursor: pointer;
      font: 600 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
    .maptoggle.off { background: rgba(34,46,28,0.82); color: #cdd8c4; }
    #windtoggle { top: 8px; }
    #depthtoggle { top: 42px; }
    .mapicon { padding: 8px; line-height: 0; }
    /* Make the icon itself non-interactive so taps always land on the button —
       on touch devices the SVG can otherwise swallow the tap. */
    .mapicon svg { display: block; pointer-events: none; }
    #fsbtn { top: 8px; left: 8px; right: auto; }
    .legendbox {
      position: absolute; z-index: 1000; right: 8px; bottom: 22px; display: none;
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 11px -apple-system, Roboto, sans-serif;
      padding: 6px 8px; border-radius: 8px; width: 140px;
    }
    .legendbox.min { width: auto; }
    .legend-head { display: flex; align-items: center; justify-content: flex-end; }
    .legendbox.min .legend-head { justify-content: space-between; gap: 10px; }
    .legend-title { font-weight: 700; display: none; }
    .legendbox.min .legend-title { display: block; }
    .legend-min {
      cursor: pointer; font-weight: 700; font-size: 15px; line-height: 1;
      padding: 0 4px; color: #cdd8c4; -webkit-user-select: none; user-select: none;
    }
    .legend-body { margin-top: 5px; }
    .legendbox.min .legend-body { display: none; }
    .legendsec { display: none; }
    .legendsec + .legendsec { margin-top: 6px; }
    .legend-when { font-weight: 700; margin-bottom: 4px; }
    .legend-bar { height: 8px; border-radius: 4px; }
    .windgrad { background: linear-gradient(to right,
      #5b8f8a, #3a7d52, #6f9e3f, #c0a233, #c08433, #b15240); }
    .depthgrad { background: linear-gradient(to right,
      #cfe8f5, #7fc4e8, #3e8fc4, #2c6aa0, #1d4373, #0e2647); }
    .legend-scale { display: flex; justify-content: space-between; margin-top: 3px; }
    .windread {
      position: absolute; z-index: 1000; left: 8px; bottom: 8px; display: none;
      max-width: calc(100% - 16px);
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 600 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Tap or drag to set your spot</div>
  <button class="maptoggle mapicon" id="fsbtn" aria-label="Full screen"></button>
  <button class="maptoggle" id="windtoggle">Wind: on</button>
  <button class="maptoggle off" id="depthtoggle">Depth: off</button>
  <div class="legendbox" id="legendbox">
    <div class="legend-head">
      <span class="legend-title">Map key</span>
      <span class="legend-min" id="legendmin">–</span>
    </div>
    <div class="legend-body">
      <div class="legendsec" id="windlegend">
        <div class="legend-when">${whenText}</div>
        <div class="legend-bar windgrad"></div>
        <div class="legend-scale"><span>0</span><span>15</span><span>30+ mph</span></div>
      </div>
      <div class="legendsec" id="depthlegend">
        <div class="legend-when">Depth (ft)</div>
        <div class="legend-bar depthgrad"></div>
        <div class="legend-scale"><span>0</span><span>60</span><span>200+</span></div>
      </div>
    </div>
  </div>
  <div class="windread" id="windread"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-velocity@2.1.4/dist/leaflet-velocity.js"></script>
  <script>
    var map = L.map('map').setView([${c.latitude}, ${c.longitude}], ${zoom});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Panes so the stack is OSM < GEBCO shading < NOAA charts < wind < markers.
    map.createPane('depthshade'); map.getPane('depthshade').style.zIndex = 350;
    map.createPane('charts'); map.getPane('charts').style.zIndex = 360;

    var marker = L.marker([${c.latitude}, ${c.longitude}], { draggable: true }).addTo(map);
    // Post any object back to the host (React Native or the parent window).
    function postHost(obj) {
      var msg = JSON.stringify(obj);
      if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(msg); }
      else if (window.parent) { window.parent.postMessage(msg, '*'); }
    }
    function send(ll) { postHost({ latitude: ll.lat, longitude: ll.lng }); }
    marker.on('dragend', function () { var ll = marker.getLatLng(); send(ll); updatePinDepth(ll, true); });
    map.on('click', function (e) { marker.setLatLng(e.latlng); send(e.latlng); updatePinDepth(e.latlng, true); });

    // Full-screen toggle. The button lives in the map (like Wind/Depth) rather
    // than as a React overlay, so the WebView can't swallow the tap. The host
    // does the resizing: native a full-screen Modal, web a full-viewport overlay.
    var SVG_EXPAND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    var SVG_SHRINK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
    var fsBtn = document.getElementById('fsbtn');
    if (fsBtn) {
      fsBtn.innerHTML = ${fullscreen ? 'true' : 'false'} ? SVG_SHRINK : SVG_EXPAND;
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(fsBtn);
        L.DomEvent.disableScrollPropagation(fsBtn);
      }
      // The host does the resizing: native presents a full-screen Modal, web
      // grows the iframe to a full-viewport overlay (iPhone Safari has no real
      // Fullscreen API, so we never call requestFullscreen). The host echoes the
      // new state back via a 'balure:fullscreen' message to flip this icon.
      fsBtn.addEventListener('click', function () { postHost({ type: 'fullscreen' }); });
    }

    // Show/hide a legend section and the box around it.
    function setLegend(id, on) {
      var sec = document.getElementById(id);
      if (sec) { sec.style.display = on ? 'block' : 'none'; }
      var box = document.getElementById('legendbox');
      if (!box) { return; }
      var w = document.getElementById('windlegend');
      var d = document.getElementById('depthlegend');
      var any = (w && w.style.display === 'block') || (d && d.style.display === 'block');
      box.style.display = any ? 'block' : 'none';
    }

    // Let the angler collapse the legend to a small chip when it crowds the map.
    var legendMin = false;
    var legendMinBtn = document.getElementById('legendmin');
    if (legendMinBtn) {
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(legendMinBtn);
        L.DomEvent.disableScrollPropagation(legendMinBtn);
      }
      legendMinBtn.addEventListener('click', function () {
        legendMin = !legendMin;
        var box = document.getElementById('legendbox');
        // className only — the inline display is owned by setLegend (layer on/off).
        if (box) { box.className = legendMin ? 'legendbox min' : 'legendbox'; }
        legendMinBtn.textContent = legendMin ? '+' : '–';
      });
    }

    // ---- Animated wind overlay (leaflet-velocity) ----
    // The hour to show, baked in from the Conditions picker. null = current.
    var windTargetISO = ${isoLiteral};
    var GRID = 5;           // GRID x GRID sample points over the view
    var windLayer = null;
    var windTimer = null;
    var windEnabled = true; // toggled by the on-map Wind button
    // Open-Meteo shares a per-IP rate limit with the Analyze forecast call, so
    // we throttle: skip refetching the same view twice, and after a 429 we
    // pause wind requests for a while to let the quota recover.
    var lastWindKey = '';
    var windCooldownUntil = 0;
    var windRetryTimer = null;

    // Surface why the wind overlay is blank (rate limit, offline, etc.) in the
    // pin-readout box instead of failing silently. A successful fetch overwrites
    // this with the real reading.
    function windStatus(msg) {
      var wr = document.getElementById('windread');
      if (wr) { wr.textContent = msg; wr.style.display = 'block'; }
    }

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

    function compass(deg) {
      var dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      var idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
      return dirs[idx] || 'N';
    }

    // Persistent readout of the wind at the pin (nearest grid sample), so a
    // direction always shows — including on touch, where hover can't fire.
    function updateSpotReadout(lats, lons, samples) {
      var wr = document.getElementById('windread');
      if (!wr) { return; }
      var ll = marker.getLatLng();
      var best = -1, bestD = Infinity;
      for (var i = 0; i < lats.length; i++) {
        var d = Math.abs(lats[i] - ll.lat) + Math.abs(lons[i] - ll.lng);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0 || !samples[best]) { return; }
      var s = samples[best];
      var mph = Math.round(s.speed * 2.23694);
      wr.textContent = 'Wind at pin: ' + compass(s.dir) + ' ' + mph + ' mph';
      wr.style.display = 'block';
    }

    function refreshWind() {
      if (!windEnabled) { return; }
      // Back off while rate-limited so we don't starve the Analyze forecast.
      if (Date.now() < windCooldownUntil) { return; }
      try {
        var b = map.getBounds();
        var north = b.getNorth(), south = b.getSouth();
        var west = b.getWest(), east = b.getEast();
        // Clamp a very wide (zoomed-out) view so the grid stays meaningful.
        if (east - west > 50) { var mx = (east + west) / 2; west = mx - 25; east = mx + 25; }
        if (north - south > 50) { var my = (north + south) / 2; south = my - 25; north = my + 25; }
        // Skip if this is the same view (rounded) we last fetched — moving the
        // marker or nudging the map shouldn't trigger a fresh request.
        var key = [north, south, west, east].map(function (n) { return n.toFixed(2); }).join(',')
          + '|' + (windTargetISO || 'now');
        if (key === lastWindKey) { return; }
        lastWindKey = key;
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
        // Only request as many forecast days as the target hour needs (1 for a
        // few days out, never the full 8) to keep the request weight low.
        var fdays = 2;
        if (windTargetISO) {
          var dd = Math.ceil((new Date(windTargetISO).getTime() - Date.now()) / 86400000) + 1;
          fdays = Math.max(1, Math.min(8, dd));
        }
        var base = 'https://api.open-meteo.com/v1/forecast'
          + '?latitude=' + lats.join(',')
          + '&longitude=' + lons.join(',')
          + '&wind_speed_unit=ms';
        var url = windTargetISO
          ? base + '&hourly=wind_speed_10m,wind_direction_10m&timezone=auto&forecast_days=' + fdays
          : base + '&current=wind_speed_10m,wind_direction_10m';
        fetch(url)
          .then(function (res) {
            // On a rate-limit, pause wind fetching for a minute and bail.
            if (res.status === 429) { windCooldownUntil = Date.now() + 60000; lastWindKey = ''; throw new Error('rate-limited'); }
            if (!res.ok) { throw new Error('http-' + res.status); }
            return res.json();
          })
          .then(function (json) {
            if (!windEnabled) { return; }
            var results = Array.isArray(json) ? json : [json];
            var samples = extractSamples(results);
            var data = buildVelocity(nx, ny, north, south, west, east, samples);
            setLegend('windlegend', true);
            updateSpotReadout(lats, lons, samples);
            // leaflet-velocity loads from a CDN; if it didn't, still show the
            // pin reading above and say the animation is missing.
            if (typeof L.velocityLayer !== 'function') {
              windStatus('Wind animation failed to load (CDN/offline)');
              return;
            }
            if (windLayer) {
              windLayer.setData(data);
              if (!map.hasLayer(windLayer)) { windLayer.addTo(map); }
              return;
            }
            // Our own pin readout (updateSpotReadout) replaces leaflet-velocity's
            // hover control, which shows "No wind data" until you hover and can't
            // work on touch at all. displayValues:false keeps that control off.
            windLayer = L.velocityLayer({
              displayValues: false,
              data: data,
              // Color scale spans 0–30 mph (13.41 m/s); see the on-map legend.
              minVelocity: 0, maxVelocity: 13.41,
              velocityScale: 0.01, opacity: 0.85,
              colorScale: ['#5b8f8a', '#3a7d52', '#6f9e3f', '#c0a233', '#c08433', '#b15240']
            });
            windLayer.addTo(map);
          })
          .catch(function (err) {
            var msg = (err && err.message) || '';
            if (msg === 'rate-limited') {
              windStatus('Wind paused — weather service busy (rate limited)');
              // Auto-recover: retry once the cooldown passes.
              if (windRetryTimer) { clearTimeout(windRetryTimer); }
              windRetryTimer = setTimeout(function () {
                windRetryTimer = null; lastWindKey = ''; refreshWind();
              }, 61000);
            } else {
              windStatus('Wind data unavailable right now (' + (msg || 'error') + ')');
            }
          });
      } catch (e) { /* wind is optional */ }
    }

    function scheduleWind() {
      if (windTimer) { clearTimeout(windTimer); }
      windTimer = setTimeout(refreshWind, 2500);
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
      if (windEnabled) {
        toggleBtn.textContent = 'Wind: on';
        toggleBtn.classList.remove('off');
        lastWindKey = ''; // bypass the dedupe so re-enabling always refetches
        windCooldownUntil = 0;
        refreshWind(); // re-fetches for the current view, re-adds the layer, shows the legend
      } else {
        toggleBtn.textContent = 'Wind: off';
        toggleBtn.classList.add('off');
        if (windLayer) { map.removeLayer(windLayer); }
        setLegend('windlegend', false);
        var wr = document.getElementById('windread');
        if (wr) { wr.style.display = 'none'; }
      }
    });

    // ---- Depth: NOAA charts + GEBCO shading + tap-to-read ----
    var depthEnabled = false; // off by default
    var noaaLayer = null;
    var depthShade = L.layerGroup();
    var depthTimer = null;

    // Stepped shallow→deep blue scale (0–200 ft+), matching the depth legend.
    function depthColorFt(ft) {
      var stops = ['#cfe8f5', '#7fc4e8', '#3e8fc4', '#2c6aa0', '#1d4373', '#0e2647'];
      var t = Math.max(0, Math.min(0.999, ft / 200));
      return stops[Math.floor(t * stops.length)];
    }

    // Coarse GEBCO depth shading over the view (cells below sea level only).
    function refreshDepthShading() {
      if (!depthEnabled) { return; }
      try {
        var b = map.getBounds();
        var north = b.getNorth(), south = b.getSouth();
        var west = b.getWest(), east = b.getEast();
        if (east - west > 30) { var mx = (east + west) / 2; west = mx - 15; east = mx + 15; }
        if (north - south > 30) { var my = (north + south) / 2; south = my - 15; north = my + 15; }
        var n = 8;
        var dLat = (north - south) / (n - 1), dLon = (east - west) / (n - 1);
        var locs = [], cells = [];
        for (var r = 0; r < n; r++) {
          var lat = north - r * dLat;
          for (var c = 0; c < n; c++) {
            var lon = west + c * dLon;
            locs.push(lat.toFixed(4) + ',' + lon.toFixed(4));
            cells.push([lat, lon]);
          }
        }
        fetch('https://api.opentopodata.org/v1/gebco2020?locations=' + locs.join('|'))
          .then(function (res) { return res.json(); })
          .then(function (j) {
            if (!depthEnabled) { return; }
            depthShade.clearLayers();
            var results = j.results || [];
            for (var i = 0; i < results.length; i++) {
              var el = results[i] ? results[i].elevation : null;
              if (el == null || el >= 0) { continue; } // at/above sea level: no depth
              var ft = -el * 3.28084;
              var cl = cells[i];
              depthShade.addLayer(L.rectangle(
                [[cl[0] - dLat / 2, cl[1] - dLon / 2], [cl[0] + dLat / 2, cl[1] + dLon / 2]],
                { stroke: false, fill: true, fillColor: depthColorFt(ft), fillOpacity: 0.42, pane: 'depthshade' }
              ));
            }
          })
          .catch(function () { /* depth shading is optional */ });
      } catch (e) { /* optional */ }
    }

    function scheduleDepth() {
      if (!depthEnabled) { return; }
      if (depthTimer) { clearTimeout(depthTimer); }
      depthTimer = setTimeout(refreshDepthShading, 700);
    }

    // Charted depth at the pin (GEBCO single point), shown in the marker popup.
    function updatePinDepth(ll, autoOpen) {
      fetch('https://api.opentopodata.org/v1/gebco2020?locations=' + ll.lat + ',' + ll.lng)
        .then(function (res) { return res.json(); })
        .then(function (j) {
          var el = j.results && j.results[0] ? j.results[0].elevation : null;
          var txt = (el != null && el < 0)
            ? '≈' + Math.round(-el * 3.28084) + ' ft deep (GEBCO)'
            : 'Bottom depth not charted here';
          marker.bindPopup(txt);
          if (autoOpen) { marker.openPopup(); }
        })
        .catch(function () { /* optional */ });
    }

    var depthBtn = document.getElementById('depthtoggle');
    if (L.DomEvent) {
      L.DomEvent.disableClickPropagation(depthBtn);
      L.DomEvent.disableScrollPropagation(depthBtn);
    }
    depthBtn.addEventListener('click', function () {
      depthEnabled = !depthEnabled;
      if (depthEnabled) {
        depthBtn.textContent = 'Depth: on';
        depthBtn.classList.remove('off');
        if (!noaaLayer) {
          // NOAA Chart Display Service (MCS WMS): 1 features, 2 depths,
          // 3 seabed, 6 aids, 11 shallow-water pattern. US coastal + Great Lakes.
          noaaLayer = L.tileLayer.wms(
            'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer',
            { layers: '1,2,3,6,11', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.9, pane: 'charts' }
          );
        }
        noaaLayer.addTo(map);
        depthShade.addTo(map);
        setLegend('depthlegend', true);
        refreshDepthShading();
      } else {
        depthBtn.textContent = 'Depth: off';
        depthBtn.classList.add('off');
        if (noaaLayer) { map.removeLayer(noaaLayer); }
        map.removeLayer(depthShade);
        setLegend('depthlegend', false);
      }
    });

    // Host hook: move the pin from outside (saved spot, geolocation, search)
    // WITHOUT snapping the zoom. Only zooms in from the wide default view the
    // first time a real location arrives; after that it keeps the angler's zoom.
    window.__moveSpot = function (lat, lng) {
      var ll = L.latLng(lat, lng);
      marker.setLatLng(ll);
      if (map.getZoom() < 10) { map.setView(ll, 12); } else { map.panTo(ll); }
      updatePinDepth(ll, false);
    };
    // On web the host can't inject JS, so it posts messages in instead.
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d) { return; }
      if (d.type === 'balure:moveSpot' && typeof d.lat === 'number') {
        window.__moveSpot(d.lat, d.lng);
      } else if (d.type === 'balure:fullscreen') {
        var fb = document.getElementById('fsbtn');
        if (fb) { fb.innerHTML = d.value ? SVG_SHRINK : SVG_EXPAND; }
      }
    });

    map.whenReady(function () {
      updatePinDepth(marker.getLatLng(), false);
      // Defer the first wind draw a tick. In a just-inserted container (e.g. the
      // web full-screen overlay) the map can mis-measure its size at whenReady,
      // which leaves the leaflet-velocity canvas sized to an old/zero box and
      // never visible. invalidateSize settles it before the layer is added.
      setTimeout(function () { map.invalidateSize(); refreshWind(); }, 250);
    });
    map.on('moveend', function () { scheduleWind(); scheduleDepth(); });
    // Belt-and-suspenders: if the container resizes after load, redraw the wind.
    window.addEventListener('resize', function () { map.invalidateSize(); scheduleWind(); });
  </script>
</body>
</html>`;
}
