import type { Coordinates } from '@/types';

export interface MapPickerProps {
  /** Where to center the map / place the initial pin. */
  center: Coordinates | null;
  /** Called whenever the user drops or drags the pin. */
  onPick: (coords: Coordinates) => void;
  /** Human label for the wind overlay's hour (e.g. "Sat 2 PM" or "Now"). */
  windTargetLabel?: string;
  /**
   * Wind at the spot for that hour, from the app's own forecast. Null (no
   * analysis yet) hides the overlay. The map makes no weather requests itself.
   */
  windMph?: number | null;
  /** Meteorological direction (degrees the wind blows FROM). */
  windDirDeg?: number | null;
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
 * A self-contained Leaflet + USGS document with a draggable pin, an animated
 * wind overlay (leaflet-velocity), and an optional depth view. Satellite
 * imagery (USGS ImageryTopo: aerials + labels) is the default base layer with
 * a toggle to the classic topo map. No API key required; the USGS National
 * Map tiles are US-government data (free, commercial OK — coverage is US
 * only, blank elsewhere).
 *
 * The pin posts the selected coordinates back to its host:
 * `window.ReactNativeWebView` on native, the parent window on web.
 *
 * Wind: drawn from the speed/direction baked in by the host (the app's own
 * forecast for the chosen hour) as a uniform flow field — the map makes no
 * weather requests of its own.
 *
 * Depth (toggle, off by default): NOAA nautical charts (real soundings/contours,
 * US coastal + Great Lakes) over a coarse GEBCO depth shading; tapping the pin
 * reads the GEBCO depth at that point. All best-effort — failures are swallowed
 * so the map still works as a plain spot-picker.
 *
 * Radar (toggle, off by default): NWS NEXRAD reflectivity tiles from the Iowa
 * Environmental Mesonet cache — an animated loop from 50 minutes ago through
 * now, then NOAA HRRR model frames carry it 2 hours into the future, so storm
 * direction, speed, and where it's headed all read at a glance. Free, no key,
 * US coverage.
 *
 * The same HTML drives both the native WebView and the web <iframe>.
 */
export function buildMapHtml(
  center: Coordinates | null,
  windTargetLabel = 'Now',
  fullscreen = false,
  windMph: number | null = null,
  windDirDeg: number | null = null,
  /** Start with the depth overlay on — so opening full screen keeps the
   * depth layer the angler already had enabled on the inline map. */
  initialDepth = false,
  /** Start with the radar loop on — so full screen keeps the radar the
   * angler already had running on the inline map. */
  initialRadar = false,
): string {
  const c = center ?? DEFAULT_CENTER;
  const zoom = center ? 12 : 4;
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
    /* Behind the tiles: USGS coverage is US-only and skips some open-ocean
       tiles, which otherwise show as stark white boxes while zooming out.
       This is toned to the imagery's ocean (setMapBg keeps it matched to the
       active base layer) so uncovered areas blend in instead of standing out.
       Default matches the satellite base (the startup layer). */
    #map { background: #34576e; }
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
      border: none;
      background: #3a7d52; color: #f7faf3; cursor: pointer;
      font: 600 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
    .maptoggle.off { background: rgba(34,46,28,0.82); color: #cdd8c4; }
    .mapicon { padding: 8px; line-height: 0; }
    /* Make the icon itself non-interactive so taps always land on the button —
       on touch devices the SVG can otherwise swallow the tap. */
    .mapicon svg { display: block; pointer-events: none; }
    #fsbtn, #centerbtn, #layersbtn { position: absolute; z-index: 1000; }
    #fsbtn { top: 8px; left: 8px; }
    #centerbtn { top: 42px; left: 8px; }
    /* One Layers button in the top-right corner; tapping it opens a column of
       the overlay toggles instead of stacking four chips over the map. */
    #layersbtn { top: 8px; right: 8px; }
    #layerspanel {
      position: absolute; z-index: 1000; right: 8px; top: 42px;
      display: none; flex-direction: column; gap: 6px; align-items: flex-end;
    }
    #layerspanel.open { display: flex; }
    .legendbox {
      position: absolute; z-index: 1000; right: 8px; bottom: 8px; display: none;
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
    .radargrad { background: linear-gradient(to right,
      #5ad2f0, #3ecc4a, #f5e63d, #f0a03c, #e03c32, #c130c9); }
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
  <button class="maptoggle mapicon" id="centerbtn" aria-label="Center on pin"></button>
  <button class="maptoggle mapicon" id="layersbtn" aria-label="Map layers"></button>
  <div id="layerspanel">
    <button class="maptoggle" id="windtoggle">Wind: on</button>
    <button class="maptoggle${initialDepth ? '' : ' off'}" id="depthtoggle">Depth: ${initialDepth ? 'on' : 'off'}</button>
    <button class="maptoggle" id="sattoggle">Sat: on</button>
    <button class="maptoggle${initialRadar ? '' : ' off'}" id="radartoggle">Radar: ${initialRadar ? 'on' : 'off'}</button>
  </div>
  <!-- Starts minimized — the expanded key crowds the map (esp. with Depth on). -->
  <div class="legendbox min" id="legendbox">
    <div class="legend-head">
      <span class="legend-title" id="legendtitle">Map key</span>
      <span class="legend-min" id="legendmin">+</span>
    </div>
    <div class="legend-body">
      <div class="legendsec" id="windlegend">
        <div class="legend-when" id="windwhen">${whenText}</div>
        <div class="legend-bar windgrad"></div>
        <div class="legend-scale"><span>0</span><span>15</span><span>30+ mph</span></div>
      </div>
      <div class="legendsec" id="depthlegend">
        <div class="legend-when">Depth (ft)</div>
        <div class="legend-bar depthgrad"></div>
        <div class="legend-scale"><span>0</span><span>60</span><span>200+</span></div>
      </div>
      <div class="legendsec" id="radarlegend">
        <div class="legend-when">Radar (rain)</div>
        <div class="legend-bar radargrad"></div>
        <div class="legend-scale"><span>Light</span><span>Heavy</span></div>
      </div>
    </div>
  </div>
  <div class="windread" id="windread"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
  <script src="https://unpkg.com/leaflet-velocity@2.1.4/dist/leaflet-velocity.js"></script>
  <script>
    // Rotation via leaflet-rotate: two-finger twist on touch, shift+drag on
    // desktop, and a compass control that resets north. If the plugin's CDN
    // script didn't load, Leaflet ignores these options and the map simply
    // stays north-up.
    var map = L.map('map', {
      rotate: true,
      touchRotate: true,
      shiftKeyRotate: true,
      rotateControl: { closeOnZeroBearing: false },
      // No attribution strip: USGS/NWS data are US-government public domain
      // (no credit required), and the Leaflet prefix is a courtesy default,
      // not a license term (BSD keeps its notice in source). Keeps the map
      // corner clean for the Map key.
      attributionControl: false
    }).setView([${c.latitude}, ${c.longitude}], ${zoom});
    // USGS The National Map tiles ({z}/{y}/{x} order), both US-government data
    // (free, commercial OK — coverage is US only, blank elsewhere). Native
    // detail tops out at 16; maxZoom 18 lets Leaflet upscale for precise pin
    // placement. Satellite (imagery + labels) is the default — anglers read
    // grass lines, laydowns, and channel edges from imagery; the Sat toggle
    // flips to the classic topo map.
    function usgsLayer(service) {
      return L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/' + service + '/MapServer/tile/{z}/{y}/{x}', {
        maxNativeZoom: 16,
        maxZoom: 18,
        attribution: 'USGS The National Map'
      });
    }
    var satLayer = usgsLayer('USGSImageryTopo');
    var topoLayer = usgsLayer('USGSTopo');
    var satEnabled = true;
    satLayer.addTo(map);

    // Panes so the stack is base tiles < GEBCO shading < NOAA charts < radar <
    // wind < markers. With leaflet-rotate active the base tile pane lives inside
    // its rotatePane (zIndex 400), so these MUST be created inside that same pane —
    // as siblings of mapPane they'd be painted over by the rotated tiles (the
    // "depth overlay disappeared" bug) and wouldn't turn with the map.
    var paneParent = map.getPane('rotatePane') || undefined;
    map.createPane('depthshade', paneParent); map.getPane('depthshade').style.zIndex = 350;
    map.createPane('charts', paneParent); map.getPane('charts').style.zIndex = 360;
    map.createPane('radar', paneParent); map.getPane('radar').style.zIndex = 370;
    // Forecast radar gets its own pane: HRRR's ~3 km cells need a stronger
    // blur than NEXRAD's ~1 km to look equally smooth.
    map.createPane('radarfcst', paneParent); map.getPane('radarfcst').style.zIndex = 371;

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
      var r = document.getElementById('radarlegend');
      var any = (w && w.style.display === 'block') || (d && d.style.display === 'block') ||
        (r && r.style.display === 'block');
      box.style.display = any ? 'block' : 'none';
    }

    // Let the angler expand the legend from its small default chip.
    var legendMin = true;
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
    // Wind comes baked in from the app's own forecast: one speed/direction for
    // the spot at the chosen hour, drawn as a uniform flow field over the
    // current view. No weather requests happen from the map.
    var windMph = ${windMph == null ? 'null' : Number(windMph)};
    var windDirDeg = ${windDirDeg == null ? '0' : Number(windDirDeg)};
    var windWhenLabel = ${JSON.stringify(windTargetLabel)};

    // The previewed day/hour shows in the expanded wind row AND in the
    // collapsed "Map key" chip, so minimizing the key never hides it.
    function updateWhenLabels() {
      var t = document.getElementById('legendtitle');
      if (t) { t.textContent = 'Map key · ' + windWhenLabel; }
      var ww = document.getElementById('windwhen');
      if (ww) { ww.textContent = 'Wind · ' + windWhenLabel; }
    }
    var GRID = 5;           // GRID x GRID field points over the view
    var windLayer = null;
    var windTimer = null;
    var windEnabled = true; // toggled by the on-map Wind button

    // Surface why the wind overlay is blank (no analysis yet, CDN offline) in
    // the pin-readout box instead of failing silently.
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

    function compass(deg) {
      var dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
      var idx = Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
      return dirs[idx] || 'N';
    }

    // Persistent readout of the wind at the pin, so a direction always shows —
    // including on touch, where hover can't fire.
    function updateSpotReadout() {
      var wr = document.getElementById('windread');
      if (!wr || windMph == null) { return; }
      wr.textContent = 'Wind at pin: ' + compass(windDirDeg) + ' ' + Math.round(windMph) + ' mph';
      wr.style.display = 'block';
    }

    function refreshWind() {
      if (!windEnabled) { return; }
      if (windMph == null) {
        // No forecast yet (the host bakes wind in after an analysis).
        setLegend('windlegend', false);
        windStatus('Wind shows after you analyze a spot');
        return;
      }
      try {
        var b = map.getBounds();
        var north = b.getNorth(), south = b.getSouth();
        var west = b.getWest(), east = b.getEast();
        var nx = GRID, ny = GRID;
        var ms = windMph * 0.44704; // mph -> m/s for the velocity field
        var samples = [];
        for (var i = 0; i < nx * ny; i++) { samples.push({ speed: ms, dir: windDirDeg }); }
        var data = buildVelocity(nx, ny, north, south, west, east, samples);
        setLegend('windlegend', true);
        updateSpotReadout();
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
      } catch (e) { /* wind is optional */ }
    }

    function scheduleWind() {
      if (windTimer) { clearTimeout(windTimer); }
      windTimer = setTimeout(refreshWind, 300);
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
        refreshWind(); // redraws for the current view, re-adds the layer, shows the legend
      } else {
        toggleBtn.textContent = 'Wind: off';
        toggleBtn.classList.add('off');
        if (windLayer) { map.removeLayer(windLayer); }
        setLegend('windlegend', false);
        var wr = document.getElementById('windread');
        if (wr) { wr.style.display = 'none'; }
      }
    });

    // Re-center on the pin: pan (and zoom in from a wide view) back to the
    // marker after scrolling away. Crosshair button under the fullscreen one.
    var SVG_CENTER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="7"/><line x1="12" y1="17" x2="12" y2="22"/><line x1="2" y1="12" x2="7" y2="12"/><line x1="17" y1="12" x2="22" y2="12"/></svg>';
    var centerBtn = document.getElementById('centerbtn');
    if (centerBtn) {
      centerBtn.innerHTML = SVG_CENTER;
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(centerBtn);
        L.DomEvent.disableScrollPropagation(centerBtn);
      }
      // Always land at zoom 17: tight on the pin so the water right around it
      // reads clearly. One past native tile detail (16), so Leaflet upscales
      // slightly — still sharp enough at this range.
      centerBtn.addEventListener('click', function () {
        map.setView(marker.getLatLng(), 17);
      });
    }

    // Layers menu: the top-right button shows/hides the overlay toggles, so
    // the corner holds one clean control instead of a stack of four chips.
    var SVG_LAYERS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
    var layersBtn = document.getElementById('layersbtn');
    var layersPanel = document.getElementById('layerspanel');
    if (layersBtn) {
      layersBtn.innerHTML = SVG_LAYERS;
      if (L.DomEvent) {
        L.DomEvent.disableClickPropagation(layersBtn);
        L.DomEvent.disableScrollPropagation(layersBtn);
      }
      layersBtn.addEventListener('click', function () {
        if (layersPanel) { layersPanel.classList.toggle('open'); }
      });
    }
    if (layersPanel && L.DomEvent) {
      L.DomEvent.disableClickPropagation(layersPanel);
      L.DomEvent.disableScrollPropagation(layersPanel);
    }

    // Keep the behind-the-tiles fill matched to the active base layer, so a
    // gap in coverage reads as more ocean rather than an out-of-place block:
    // a slate blue under the satellite imagery, a pale blue under the topo map.
    function setMapBg() {
      var el = document.getElementById('map');
      if (el) { el.style.background = satEnabled ? '#34576e' : '#c7dae2'; }
    }
    setMapBg();

    // Satellite/topo base-layer toggle, same chip pattern as Wind/Depth.
    var satBtn = document.getElementById('sattoggle');
    if (satBtn && L.DomEvent) {
      L.DomEvent.disableClickPropagation(satBtn);
      L.DomEvent.disableScrollPropagation(satBtn);
    }
    if (satBtn) {
      satBtn.addEventListener('click', function () {
        satEnabled = !satEnabled;
        if (satEnabled) {
          satBtn.textContent = 'Sat: on';
          satBtn.classList.remove('off');
          map.removeLayer(topoLayer);
          satLayer.addTo(map);
        } else {
          satBtn.textContent = 'Sat: off';
          satBtn.classList.add('off');
          map.removeLayer(satLayer);
          topoLayer.addTo(map);
        }
        setMapBg();
      });
    }

    // ---- Weather radar: animated NWS NEXRAD loop + HRRR forecast ----
    // Reflectivity tiles from the Iowa Environmental Mesonet (free, no key,
    // US coverage — blank elsewhere, same as the USGS base maps). Eleven
    // observed frames step from 50 minutes ago to now, then eight NOAA HRRR
    // model frames carry the loop 2 hours into the future, so storm direction
    // AND where it's headed both read at a glance.
    var RADAR_STEPS = ['-m50m','-m45m','-m40m','-m35m','-m30m','-m25m','-m20m','-m15m','-m10m','-m05m',''];
    var HRRR_WMS = 'https://mesonet.agron.iastate.edu/cgi-bin/wms/hrrr/refd.cgi';
    // Baked in by the host so full screen inherits the inline map's radar loop.
    var radarEnabled = ${initialRadar ? 'true' : 'false'};
    var radarPaused = false; // true while the host's timeline is scrubbing
    var radarFrames = []; // { label, layer, opacity } — past frames then forecast
    var radarIdx = 0;
    var radarNowIdx = RADAR_STEPS.length - 1; // where "now" sits in the loop
    var radarAnimTimer = null;
    var radarRefreshTimer = null;

    // Radar cells rendered crisply read as hard squares once zoomed in. Blur
    // each pane by ~a third of a cell's on-screen size so the returns look
    // like weather, not pixels (capped so deep zooms stay usable). NEXRAD
    // observations are ~1 km cells; HRRR forecast frames are ~3 km, so they
    // get triple the blur to match the observed frames' smoothness.
    function smoothRadar() {
      var cellPx = 256 * Math.pow(2, map.getZoom()) / 40075; // ~1 km in px
      var obs = map.getPane('radar');
      if (obs) { obs.style.filter = 'blur(' + Math.min(10, Math.max(1, cellPx / 3)).toFixed(1) + 'px)'; }
      var fc = map.getPane('radarfcst');
      if (fc) { fc.style.filter = 'blur(' + Math.min(14, Math.max(1.5, cellPx)).toFixed(1) + 'px)'; }
    }

    function removeRadarLayers() {
      for (var i = 0; i < radarFrames.length; i++) { map.removeLayer(radarFrames[i].layer); }
      radarFrames = [];
    }

    function buildRadarLayers() {
      // Cache-bust on a 5-minute bucket (NEXRAD's update cadence) so a long
      // session or a re-toggle pulls fresh frames, not the browser's old loop.
      var bucket = Math.floor(Date.now() / 300000);
      removeRadarLayers();
      var frames = [];
      for (var i = 0; i < RADAR_STEPS.length; i++) {
        var back = (RADAR_STEPS.length - 1 - i) * 5;
        frames.push({
          label: back === 0 ? 'Radar · now' : 'Radar · ' + back + ' min ago',
          opacity: 0.7,
          layer: L.tileLayer(
            'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913' + RADAR_STEPS[i] + '/{z}/{x}/{y}.png?_=' + bucket,
            { pane: 'radar', opacity: 0, maxNativeZoom: 12, maxZoom: 18 }
          )
        });
      }
      radarNowIdx = frames.length - 1;
      // Next 2 hours: HRRR simulated reflectivity (NOAA's rapid-refresh
      // forecast model, 15-min steps). The WMS serves the latest run and its
      // layers are minutes-from-run-init; runs land ~55 minutes after init,
      // so anchor on that to translate "now + k" into a run-relative minute.
      // Slightly dimmer than the observed frames — it's a forecast.
      var initGuess = Math.floor((Date.now() - 55 * 60000) / 3600000) * 3600000;
      for (var k = 1; k <= 8; k++) {
        var m = Math.round((Date.now() + k * 15 * 60000 - initGuess) / 60000 / 15) * 15;
        if (m > 1080) { break; }
        frames.push({
          label: 'Radar · +' + (k * 15) + ' min forecast',
          opacity: 0.55,
          layer: L.tileLayer.wms(HRRR_WMS + '?_=' + bucket, {
            layers: 'refd_' + ('0000' + m).slice(-4),
            format: 'image/png', transparent: true,
            pane: 'radarfcst', opacity: 0, maxZoom: 18
          })
        });
      }
      // Every frame mounts at opacity 0 so its tiles preload; the animation
      // just flips opacities, which keeps the loop smooth.
      for (var j = 0; j < frames.length; j++) { frames[j].layer.addTo(map); }
      radarFrames = frames;
    }

    function showRadarFrame(idx) {
      if (!radarFrames.length) { return; }
      radarIdx = ((idx % radarFrames.length) + radarFrames.length) % radarFrames.length;
      for (var i = 0; i < radarFrames.length; i++) {
        radarFrames[i].layer.setOpacity(i === radarIdx ? radarFrames[i].opacity : 0);
      }
      // The host's external timeline shows the frame's time and tracks the
      // loop; the map itself stays clean (no in-map radar readout).
      postHost({ type: 'radarFrame', idx: radarIdx });
    }

    function stepRadar() {
      if (!radarEnabled || radarPaused || !radarFrames.length) { return; }
      var next = (radarIdx + 1) % radarFrames.length;
      showRadarFrame(next);
      // Hold at "now" (the observed/forecast seam) and at the end of the
      // forecast, so both moments read clearly before the loop moves on.
      var hold = next === radarNowIdx || next === radarFrames.length - 1 ? 1500 : 450;
      radarAnimTimer = setTimeout(stepRadar, hold);
    }

    function startRadar() {
      radarPaused = false;
      buildRadarLayers();
      smoothRadar();
      showRadarFrame(radarNowIdx);
      // Tell the host what's in the loop so it can draw its timeline.
      postHost({
        type: 'radar', on: true, idx: radarIdx, nowIdx: radarNowIdx,
        frames: radarFrames.map(function (f) { return f.label; })
      });
      if (radarAnimTimer) { clearTimeout(radarAnimTimer); }
      radarAnimTimer = setTimeout(stepRadar, 1600);
      // Rebuild while enabled so the loop tracks the latest sweeps — but not
      // while the angler has the timeline paused on a frame they're studying.
      if (radarRefreshTimer) { clearInterval(radarRefreshTimer); }
      radarRefreshTimer = setInterval(function () {
        if (radarEnabled && !radarPaused) { buildRadarLayers(); showRadarFrame(radarIdx); }
      }, 300000);
    }

    function stopRadar() {
      if (radarAnimTimer) { clearTimeout(radarAnimTimer); radarAnimTimer = null; }
      if (radarRefreshTimer) { clearInterval(radarRefreshTimer); radarRefreshTimer = null; }
      radarPaused = false;
      removeRadarLayers();
      postHost({ type: 'radar', on: false });
    }

    // Host hooks for the external timeline (drawn by the app below the inline
    // map and along the bottom of full screen): scrubbing pauses the loop on
    // a frame; play resumes the animation from wherever the thumb sits.
    window.__radarScrub = function (idx) {
      if (!radarFrames.length) { return; }
      radarPaused = true;
      if (radarAnimTimer) { clearTimeout(radarAnimTimer); }
      showRadarFrame(idx);
    };
    window.__radarPlay = function () {
      if (!radarFrames.length) { return; }
      radarPaused = false;
      if (radarAnimTimer) { clearTimeout(radarAnimTimer); }
      radarAnimTimer = setTimeout(stepRadar, 200);
    };

    var radarBtn = document.getElementById('radartoggle');
    if (radarBtn && L.DomEvent) {
      L.DomEvent.disableClickPropagation(radarBtn);
      L.DomEvent.disableScrollPropagation(radarBtn);
    }
    if (radarBtn) {
      radarBtn.addEventListener('click', function () {
        radarEnabled = !radarEnabled;
        if (radarEnabled) {
          radarBtn.textContent = 'Radar: on';
          radarBtn.classList.remove('off');
          setLegend('radarlegend', true);
          startRadar();
        } else {
          radarBtn.textContent = 'Radar: off';
          radarBtn.classList.add('off');
          setLegend('radarlegend', false);
          stopRadar();
        }
      });
    }
    // Apply the baked-in initial state (full screen opened with radar already
    // on): kick off the loop now that its functions are defined. This also
    // posts to the host, so the full-screen timeline appears.
    if (radarEnabled) { setLegend('radarlegend', true); startRadar(); }

    // ---- Depth: NOAA charts + GEBCO shading + tap-to-read ----
    // Baked in by the host so full screen inherits the inline map's depth
    // state instead of resetting to off.
    var depthEnabled = ${initialDepth ? 'true' : 'false'};
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
    // setDepth drives the layer, legend and button from one place so the click
    // handler AND the baked-in initial state (full screen) share it, and the
    // host is told the state so a newly-opened full screen can inherit it.
    function setDepth(on) {
      depthEnabled = on;
      if (on) {
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
      postHost({ type: 'depth', on: on });
    }
    depthBtn.addEventListener('click', function () { setDepth(!depthEnabled); });
    // Apply the baked-in initial state (full screen opened with depth already
    // on): mount the layers now that everything it needs is defined.
    if (depthEnabled) { depthEnabled = false; setDepth(true); }

    // Host hook: move the pin from outside (saved spot, geolocation, search)
    // and land at the same close-up the recenter button uses, so picking a
    // spot always frames the water right around it. (The host skips the
    // redundant first call for the center already baked into this document,
    // so simply opening the app doesn't yank the zoom.)
    window.__moveSpot = function (lat, lng) {
      var ll = L.latLng(lat, lng);
      marker.setLatLng(ll);
      map.setView(ll, 17);
      updatePinDepth(ll, false);
    };
    // Host hook: re-time the wind overlay (new day/hour or fresh analysis)
    // WITHOUT rebuilding the document. Reloading the WebView/iframe resets the
    // view to the default zoom — the "map keeps zooming out" bug — so wind
    // updates must flow through here, never through a new srcDoc/html.
    window.__setWind = function (mph, dirDeg, label) {
      windMph = (mph == null ? null : Number(mph));
      windDirDeg = (dirDeg == null ? 0 : Number(dirDeg));
      if (label != null) { windWhenLabel = String(label); }
      updateWhenLabels();
      if (windMph == null && windLayer && map.hasLayer(windLayer)) { map.removeLayer(windLayer); }
      refreshWind();
    };
    // On web the host can't inject JS, so it posts messages in instead.
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d) { return; }
      if (d.type === 'balure:moveSpot' && typeof d.lat === 'number') {
        window.__moveSpot(d.lat, d.lng);
      } else if (d.type === 'balure:setWind') {
        window.__setWind(d.mph, d.dir, d.label);
      } else if (d.type === 'balure:radarScrub' && typeof d.idx === 'number') {
        window.__radarScrub(d.idx);
      } else if (d.type === 'balure:radarPlay') {
        window.__radarPlay();
      } else if (d.type === 'balure:fullscreen') {
        var fb = document.getElementById('fsbtn');
        if (fb) { fb.innerHTML = d.value ? SVG_SHRINK : SVG_EXPAND; }
      }
    });

    map.whenReady(function () {
      updateWhenLabels();
      updatePinDepth(marker.getLatLng(), false);
      // Defer the first wind draw a tick. In a just-inserted container (e.g. the
      // web full-screen overlay) the map can mis-measure its size at whenReady,
      // which leaves the leaflet-velocity canvas sized to an old/zero box and
      // never visible. invalidateSize settles it before the layer is added.
      setTimeout(function () { map.invalidateSize(); refreshWind(); }, 250);
    });
    map.on('moveend', function () { scheduleWind(); scheduleDepth(); smoothRadar(); });
    // Belt-and-suspenders: if the container resizes after load, redraw the wind.
    window.addEventListener('resize', function () { map.invalidateSize(); scheduleWind(); });
  </script>
</body>
</html>`;
}
