import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';
import { makeStyles, radius, useTheme } from '@/theme';
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
  // without reloading, so each map keeps its zoom.
  useEffect(() => {
    if (internalPick.current) {
      internalPick.current = false; // a map already placed this pin
      return;
    }
    if (!center) return;
    const msg = { type: 'balure:moveSpot', lat: center.latitude, lng: center.longitude };
    inlineRef.current?.contentWindow?.postMessage(msg, '*');
    fullRef.current?.contentWindow?.postMessage(msg, '*');
  }, [center]);

  // Rebuild a document only when the wind hour changes (to re-time the overlay).
  // Center changes are pushed via postMessage instead. The full-screen variant
  // bakes the "shrink" icon (fullscreen=true).
  const srcDoc = useMemo(
    () => buildMapHtml(centerRef.current, windTargetISO, windTargetLabel, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windTargetISO, windTargetLabel],
  );
  // Keyed on `expanded` too, so each time it opens it bakes in the *current*
  // location; it stays stable while open (no reload).
  const srcDocFull = useMemo(
    () => buildMapHtml(centerRef.current, windTargetISO, windTargetLabel, true),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windTargetISO, windTargetLabel, expanded],
  );

  const inlineIframe = createElement('iframe', {
    ref: inlineRef,
    srcDoc,
    style: { width: '100%', height: '100%', border: 'none', display: 'block' },
    title: 'Pick your fishing spot',
  });

  const fullscreen =
    expanded && typeof document !== 'undefined'
      ? createPortal(
          createElement('iframe', {
            ref: fullRef,
            srcDoc: srcDocFull,
            style: {
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 2147483647,
              border: 'none',
              display: 'block',
              background: colors.bgElevated,
            },
            title: 'Pick your fishing spot (full screen)',
          }),
          document.body,
        )
      : null;

  return (
    <View style={styles.frame}>
      {inlineIframe}
      {fullscreen}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));
