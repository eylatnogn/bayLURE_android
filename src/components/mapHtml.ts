import type { Coordinates } from '@/types';

export interface MapPickerProps {
  /** Where to center the map / place the initial pin. */
  center: Coordinates | null;
  /** Called whenever the user drops or drags the pin. */
  onPick: (coords: Coordinates) => void;
  height?: number;
}

/** Sensible fallback when we have no location yet (continental US). */
export const DEFAULT_CENTER: Coordinates = {
  latitude: 39.5,
  longitude: -98.35,
};

/**
 * A self-contained Leaflet + OpenStreetMap document with a draggable pin.
 * No API key required. It posts the selected coordinates back to its host:
 * `window.ReactNativeWebView` on native, the parent window on web.
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
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .hint {
      position: absolute; z-index: 1000; left: 8px; top: 8px;
      background: rgba(34,46,28,0.82); color: #f8faf1;
      font: 12px -apple-system, Roboto, sans-serif;
      padding: 6px 10px; border-radius: 8px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Tap the map or drag the pin to set your spot</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
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
  </script>
</body>
</html>`;
}
