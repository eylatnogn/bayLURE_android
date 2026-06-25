import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';

// Web implementation. Renders the shared Leaflet document inside an <iframe>
// (a real DOM element, since Expo web runs on react-dom) and listens for the
// coordinates the map posts back to the parent window.
export function MapPicker({
  center,
  onPick,
  windTargetISO = null,
  windTargetLabel = 'Now',
}: MapPickerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // Latest center — read when the srcDoc is rebuilt for a wind-time change.
  const centerRef = useRef(center);
  centerRef.current = center;
  // True when a pin move came from a click/drag inside the map: the map already
  // moved the view, so we must NOT post it back (which could disturb the zoom).
  const internalPick = useRef(false);
  // Full-screen via a CSS overlay (the iframe grows to fill the viewport). We
  // avoid the Fullscreen API because iPhone Safari doesn't support it.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function handler(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (data?.type === 'fullscreen') {
          setExpanded((v) => !v);
          return;
        }
        if (typeof data?.latitude === 'number') {
          internalPick.current = true;
          onPick({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        // Ignore non-JSON messages from other sources.
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPick]);

  // Move the pin without reloading the iframe, so the zoom is preserved.
  useEffect(() => {
    if (internalPick.current) {
      internalPick.current = false; // the map already placed this pin
      return;
    }
    if (!center) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'balure:moveSpot', lat: center.latitude, lng: center.longitude },
      '*',
    );
  }, [center]);

  // Tell the in-map button which icon (expand vs shrink) to show.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'balure:fullscreen', value: expanded },
      '*',
    );
  }, [expanded]);

  // Rebuild the document only when the wind hour changes (to re-time the
  // overlay). Center changes are pushed via postMessage instead, so selecting a
  // spot never reloads the iframe or resets the zoom.
  const srcDoc = useMemo(
    () => buildMapHtml(centerRef.current, windTargetISO, windTargetLabel),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windTargetISO, windTargetLabel],
  );

  // Only the style changes between inline and full screen — React keeps the same
  // iframe element, so the map (and its zoom) is preserved across the toggle.
  const iframe = createElement('iframe', {
    ref: iframeRef,
    srcDoc,
    style: expanded
      ? {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          border: 'none',
          display: 'block',
          background: colors.bgElevated,
        }
      : { width: '100%', height: '100%', border: 'none', display: 'block' },
    title: 'Pick your fishing spot',
  });

  return <View style={styles.frame}>{iframe}</View>;
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    // Phone-width browsers stay below this, so mobile is unchanged; on a wide
    // desktop viewport the square stops growing and centers instead of
    // spanning the whole page.
    maxWidth: 520,
    alignSelf: 'center',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
});
