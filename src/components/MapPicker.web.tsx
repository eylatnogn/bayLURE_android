import { createElement, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';
import { makeStyles, radius, useTheme } from '@/theme';
import { fetchDemMeters } from '@/api/depth';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';
import {
  RadarTimeline,
  type RadarControl,
  type RadarTimelineState,
} from '@/components/RadarTimeline';

// Web implementation. Renders the shared Leaflet document inside an <iframe>
// (a real DOM element, since Expo web runs on react-dom) and listens for the
// coordinates the map posts back to the parent window.
export function MapPicker({
  center,
  onPick,
  windTargetLabel = 'Now',
  windMph = null,
  windDirDeg = null,
}: MapPickerProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inlineRef = useRef<HTMLIFrameElement | null>(null);
  const fullRef = useRef<HTMLIFrameElement | null>(null);
  // Latest center — read when a srcDoc is rebuilt for a wind-time change.
  const centerRef = useRef(center);
  centerRef.current = center;
  // True when a pin move came from a click/drag inside a map: that map already
  // moved its own view, so the external-center effect must not post it back.
  const internalPick = useRef(false);
  // Full screen is a CSS overlay portaled to <body> (the Fullscreen API isn't
  // available on iPhone Safari, and a portal escapes every stacking context so
  // it reliably sits above the whole app).
  const [expanded, setExpanded] = useState(false);
  // Radar timeline state — per iframe (inline and full screen each run their
  // own radar loop, just like they keep their own zoom).
  const [inlineRadar, setInlineRadar] = useState<RadarTimelineState | null>(null);
  const [fullRadar, setFullRadar] = useState<RadarTimelineState | null>(null);

  // Inline map's depth + radar state, so a newly-opened full screen inherits
  // them instead of resetting. Refs: only read at open time, and they mustn't
  // rebuild the inline document.
  const depthOnRef = useRef(false);
  const radarOnRef = useRef(false);
  const contourOnRef = useRef(false);

  // The full-screen iframe unmounts with the overlay; drop its timeline too.
  useEffect(() => {
    if (!expanded) setFullRadar(null);
  }, [expanded]);

  useEffect(() => {
    function handler(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'fullscreen') {
          setExpanded((v) => !v);
          return;
        }
        if (data?.type === 'depth') {
          // Seed full screen from the INLINE map's depth state.
          if (event.source === inlineRef.current?.contentWindow) {
            depthOnRef.current = !!data.on;
          }
          return;
        }
        if (data?.type === 'contour') {
          if (event.source === inlineRef.current?.contentWindow) {
            contourOnRef.current = !!data.on;
          }
          return;
        }
        if (data?.type === 'depthReq') {
          // NCEI's DEM sends CORS headers, so this browser fetch works and the
          // web build now draws depth/contours too (the old GEBCO source was
          // CORS-blocked). Stale replies are dropped by the asking map by id.
          const src = event.source as Window | null;
          void (async () => {
            try {
              const results = await fetchDemMeters(data.cells as [number, number][]);
              src?.postMessage(
                {
                  type: 'balure:depthCells',
                  payload: { id: data.id, cells: data.cells, dLat: data.dLat, dLon: data.dLon, results },
                },
                '*',
              );
            } catch {
              // Depth shading is best-effort on web.
            }
          })();
          return;
        }
        if (data?.type === 'pinDepthReq') {
          const src = event.source as Window | null;
          void (async () => {
            try {
              const [m] = await fetchDemMeters([[data.lat, data.lng]]);
              const text =
                m != null && m < 0
                  ? `≈${Math.round(-m * 3.28084)} ft deep (NOAA DEM)`
                  : 'Bottom depth not charted here';
              src?.postMessage(
                { type: 'balure:pinDepth', payload: { text, autoOpen: !!data.autoOpen } },
                '*',
              );
            } catch {
              // Optional on web.
            }
          })();
          return;
        }
        if (data?.type === 'radar' || data?.type === 'radarFrame') {
          const fromFull = event.source === fullRef.current?.contentWindow;
          const set = fromFull ? setFullRadar : setInlineRadar;
          // Track the inline map's radar on/off to seed a new full screen.
          if (data.type === 'radar' && !fromFull) radarOnRef.current = !!data.on;
          if (data.type === 'radar') {
            set(
              data.on
                ? {
                    frames: Array.isArray(data.frames) ? data.frames : [],
                    idx: data.idx ?? 0,
                    nowIdx: data.nowIdx ?? -1,
                    playing: true,
                  }
                : null,
            );
          } else if (typeof data.idx === 'number') {
            set((r) => (r ? { ...r, idx: data.idx } : r));
          }
          return;
        }
        if (typeof data?.latitude === 'number') {
          internalPick.current = true;
          // Mirror the pin into the *other* map so inline and full screen agree.
          const msg = { type: 'balure:moveSpot', lat: data.latitude, lng: data.longitude };
          const fromInline = event.source === inlineRef.current?.contentWindow;
          (fromInline ? fullRef : inlineRef).current?.contentWindow?.postMessage(msg, '*');
          onPick({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        // Ignore non-JSON messages from other sources.
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPick]);

  // External center change (geolocation/search/saved spot): move both pins
  // without reloading. __moveSpot lands at the recenter close-up, so skip the
  // redundant first call for the center already baked into the documents —
  // opening the app shouldn't yank the zoom to 17.
  const bakedCenter = useRef(center);
  useEffect(() => {
    if (internalPick.current) {
      internalPick.current = false; // a map already placed this pin
      return;
    }
    if (!center) return;
    const baked = bakedCenter.current;
    bakedCenter.current = null; // only ever skip the first call
    if (baked && baked.latitude === center.latitude && baked.longitude === center.longitude) {
      return;
    }
    const msg = { type: 'balure:moveSpot', lat: center.latitude, lng: center.longitude };
    inlineRef.current?.contentWindow?.postMessage(msg, '*');
    fullRef.current?.contentWindow?.postMessage(msg, '*');
  }, [center]);

  // Latest wind — read when a srcDoc is (re)built, so the full-screen map
  // bakes in the current values when it opens.
  const windRef = useRef({ label: windTargetLabel, mph: windMph, dir: windDirDeg });
  windRef.current = { label: windTargetLabel, mph: windMph, dir: windDirDeg };

  // Push wind changes into the LIVE documents instead of rebuilding them: an
  // iframe reload resets the view to the default zoom, which read as the map
  // "glitching out and zooming out" whenever the day/hour selection changed.
  useEffect(() => {
    const msg = { type: 'balure:setWind', mph: windMph, dir: windDirDeg, label: windTargetLabel };
    inlineRef.current?.contentWindow?.postMessage(msg, '*');
    fullRef.current?.contentWindow?.postMessage(msg, '*');
  }, [windTargetLabel, windMph, windDirDeg]);

  // Build each document ONCE. Center changes are pushed via postMessage
  // (balure:moveSpot) and wind via balure:setWind — never a new srcDoc.
  const srcDoc = useMemo(
    () => buildMapHtml(centerRef.current, windRef.current.label, false, windRef.current.mph, windRef.current.dir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // Keyed on `expanded`, so each time it opens it bakes in the *current*
  // location, wind, and the inline map's depth state; stable while open.
  const srcDocFull = useMemo(
    () =>
      buildMapHtml(
        centerRef.current,
        windRef.current.label,
        true,
        windRef.current.mph,
        windRef.current.dir,
        depthOnRef.current,
        radarOnRef.current,
        contourOnRef.current,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expanded],
  );

  // Scrub/play commands for one iframe's radar loop, over postMessage.
  const controlFor = (ref: MutableRefObject<HTMLIFrameElement | null>): RadarControl => ({
    scrub: (idx) =>
      ref.current?.contentWindow?.postMessage({ type: 'balure:radarScrub', idx: Math.round(idx) }, '*'),
    play: () => ref.current?.contentWindow?.postMessage({ type: 'balure:radarPlay' }, '*'),
  });

  const timelineFor = (
    radar: RadarTimelineState | null,
    control: RadarControl,
    set: (fn: (r: RadarTimelineState | null) => RadarTimelineState | null) => void,
  ) => {
    if (!radar || radar.frames.length < 2) return null;
    return (
      <RadarTimeline
        frames={radar.frames}
        index={radar.idx}
        nowIndex={radar.nowIdx}
        playing={radar.playing}
        onScrub={(i) => {
          control.scrub(i);
          set((r) => (r ? { ...r, idx: i, playing: false } : r));
        }}
        onPlayPause={() => {
          if (radar.playing) {
            control.scrub(radar.idx);
            set((r) => (r ? { ...r, playing: false } : r));
          } else {
            control.play();
            set((r) => (r ? { ...r, playing: true } : r));
          }
        }}
      />
    );
  };

  const inlineIframe = createElement('iframe', {
    ref: inlineRef,
    srcDoc,
    style: { width: '100%', height: '100%', border: 'none', display: 'block' },
    title: 'Pick your fishing spot',
  });

  // Full screen: the iframe fills the overlay; the radar timeline (when the
  // radar is on in THAT map) floats along the bottom, outside the map itself.
  const fullscreen =
    expanded && typeof document !== 'undefined'
      ? createPortal(
          createElement(
            'div',
            {
              style: {
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                zIndex: 2147483647,
                background: colors.bgElevated,
              },
            },
            createElement('iframe', {
              ref: fullRef,
              srcDoc: srcDocFull,
              style: { width: '100%', height: '100%', border: 'none', display: 'block' },
              title: 'Pick your fishing spot (full screen)',
            }),
            fullRadar
              ? createElement(
                  'div',
                  { style: { position: 'absolute', left: 12, right: 12, bottom: 12 } },
                  timelineFor(fullRadar, controlFor(fullRef), setFullRadar),
                )
              : null,
          ),
          document.body,
        )
      : null;

  return (
    <View style={styles.outer}>
      <View style={styles.frame}>{inlineIframe}</View>
      {timelineFor(inlineRadar, controlFor(inlineRef), setInlineRadar)}
      {fullscreen}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  outer: {
    width: '100%',
    // Phone-width browsers stay below this, so mobile is unchanged; on a wide
    // desktop viewport the square stops growing and centers instead of
    // spanning the whole page. The radar timeline below shares the width.
    maxWidth: 520,
    alignSelf: 'center',
  },
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
}));
