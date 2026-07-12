import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { makeStyles, radius, spacing } from '@/theme';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';
import {
  RadarTimeline,
  type RadarControl,
  type RadarTimelineState,
} from '@/components/RadarTimeline';

interface CanvasProps extends MapPickerProps {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Radar loop updates from the map ({type:'radar'} / {type:'radarFrame'}). */
  onRadar: (data: { type: string; on?: boolean; frames?: string[]; idx?: number; nowIdx?: number }) => void;
  /** Receives scrub/play commands the host timeline can send into this map. */
  controlRef: MutableRefObject<RadarControl | null>;
}

// The Leaflet WebView. The expand/collapse control lives *inside* the map HTML
// (see #fsbtn in mapHtml) so the WebView can't swallow the tap; it posts a
// {type:'fullscreen'} message that we turn into a Modal toggle here. Rendered
// both inline (square) and full-screen — each instance keeps its own
// zoom/layers, which is fine since they sync through the `center` prop.
function MapCanvas({
  center,
  onPick,
  windTargetLabel = 'Now',
  windMph = null,
  windDirDeg = null,
  fullscreen,
  onToggleFullscreen,
  onRadar,
  controlRef,
}: CanvasProps) {
  const styles = useStyles();
  const webRef = useRef<WebView>(null);
  // Latest center — read when the HTML is rebuilt for a wind-time change.
  const centerRef = useRef(center);
  centerRef.current = center;
  // True when a pin move came from a tap/drag inside the map: the map already
  // moved the view, so we must NOT re-inject (which could disturb the zoom).
  const internalPick = useRef(false);

  // Build the document ONCE per instance. Center changes are pushed via
  // injectJavaScript (__moveSpot) and wind changes via __setWind, so nothing
  // ever reloads the WebView — a reload resets the view to the default zoom,
  // which read as the map "glitching out and zooming out" every time the
  // shared day/hour selection changed.
  const initialWind = useRef({ label: windTargetLabel, mph: windMph, dir: windDirDeg });
  const html = useMemo(
    () =>
      buildMapHtml(
        centerRef.current,
        initialWind.current.label,
        fullscreen,
        initialWind.current.mph,
        initialWind.current.dir,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullscreen],
  );

  useEffect(() => {
    if (internalPick.current) {
      internalPick.current = false; // the map already placed this pin
      return;
    }
    if (!center) return;
    webRef.current?.injectJavaScript(
      `window.__moveSpot && window.__moveSpot(${center.latitude}, ${center.longitude}); true;`,
    );
  }, [center]);

  // Re-time the wind overlay in the live document (no reload, zoom kept).
  useEffect(() => {
    webRef.current?.injectJavaScript(
      `window.__setWind && window.__setWind(${windMph == null ? 'null' : Number(windMph)}, ${
        windDirDeg == null ? 'null' : Number(windDirDeg)
      }, ${JSON.stringify(windTargetLabel)}); true;`,
    );
  }, [windTargetLabel, windMph, windDirDeg]);

  // Hand the host timeline a way to drive this map's radar loop.
  useEffect(() => {
    controlRef.current = {
      scrub: (idx) =>
        webRef.current?.injectJavaScript(
          `window.__radarScrub && window.__radarScrub(${Math.round(idx)}); true;`,
        ),
      play: () => webRef.current?.injectJavaScript('window.__radarPlay && window.__radarPlay(); true;'),
    };
    return () => {
      controlRef.current = null;
    };
  }, [controlRef]);

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html }}
      style={styles.web}
      // Android: without this, a vertical drag on the map is claimed by the
      // surrounding ScrollView, so the page scrolls instead of the map panning.
      nestedScrollEnabled
      overScrollMode="never"
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data?.type === 'fullscreen') {
            onToggleFullscreen();
            return;
          }
          if (data?.type === 'radar' || data?.type === 'radarFrame') {
            onRadar(data);
            return;
          }
          if (typeof data.latitude === 'number') {
            internalPick.current = true;
            onPick({ latitude: data.latitude, longitude: data.longitude });
          }
        } catch {
          // Ignore malformed messages.
        }
      }}
    />
  );
}

// Translate the map's radar messages into timeline state for one instance.
function radarReducer(
  data: { type: string; on?: boolean; frames?: string[]; idx?: number; nowIdx?: number },
  set: (fn: (r: RadarTimelineState | null) => RadarTimelineState | null) => void,
) {
  if (data.type === 'radar') {
    set(() =>
      data.on
        ? {
            frames: Array.isArray(data.frames) ? data.frames : [],
            idx: data.idx ?? 0,
            nowIdx: data.nowIdx ?? -1,
            playing: true,
          }
        : null,
    );
  } else if (data.type === 'radarFrame' && typeof data.idx === 'number') {
    set((r) => (r ? { ...r, idx: data.idx! } : r));
  }
}

// One timeline wired to one map instance's radar loop.
function timelineFor(
  radar: RadarTimelineState | null,
  control: MutableRefObject<RadarControl | null>,
  set: (fn: (r: RadarTimelineState | null) => RadarTimelineState | null) => void,
) {
  if (!radar || radar.frames.length < 2) return null;
  return (
    <RadarTimeline
      frames={radar.frames}
      index={radar.idx}
      nowIndex={radar.nowIdx}
      playing={radar.playing}
      onScrub={(i) => {
        control.current?.scrub(i);
        set((r) => (r ? { ...r, idx: i, playing: false } : r));
      }}
      onPlayPause={() => {
        if (radar.playing) {
          control.current?.scrub(radar.idx);
          set((r) => (r ? { ...r, playing: false } : r));
        } else {
          control.current?.play();
          set((r) => (r ? { ...r, playing: true } : r));
        }
      }}
    />
  );
}

// Native (iOS / Android) implementation. Metro automatically substitutes
// MapPicker.web.tsx when bundling for web. react-native-webview ships inside
// Expo Go, so this works without a custom dev build.
export function MapPicker(props: MapPickerProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  // Radar timeline state — per map instance (inline and full screen each run
  // their own radar loop, just like they keep their own zoom).
  const [inlineRadar, setInlineRadar] = useState<RadarTimelineState | null>(null);
  const [fullRadar, setFullRadar] = useState<RadarTimelineState | null>(null);
  const inlineCtl = useRef<RadarControl | null>(null);
  const fullCtl = useRef<RadarControl | null>(null);

  // The full-screen map unmounts with the modal; drop its timeline with it.
  useEffect(() => {
    if (!expanded) setFullRadar(null);
  }, [expanded]);

  return (
    <View>
      <View style={styles.frame}>
        <MapCanvas
          {...props}
          fullscreen={false}
          onToggleFullscreen={() => setExpanded(true)}
          onRadar={(d) => radarReducer(d, setInlineRadar)}
          controlRef={inlineCtl}
        />
      </View>
      {timelineFor(inlineRadar, inlineCtl, setInlineRadar)}
      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <SafeAreaView style={styles.modalRoot}>
          {expanded ? (
            <>
              <View style={styles.modalMap}>
                <MapCanvas
                  {...props}
                  fullscreen
                  onToggleFullscreen={() => setExpanded(false)}
                  onRadar={(d) => radarReducer(d, setFullRadar)}
                  controlRef={fullCtl}
                />
              </View>
              {fullRadar ? (
                <View style={styles.modalTimeline}>
                  {timelineFor(fullRadar, fullCtl, setFullRadar)}
                </View>
              ) : null}
            </>
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalMap: {
    flex: 1,
  },
  modalTimeline: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  web: {
    flex: 1,
    backgroundColor: colors.bgElevated,
  },
}));
