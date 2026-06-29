import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, SafeAreaView, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { makeStyles, radius } from '@/theme';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';

interface CanvasProps extends MapPickerProps {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

// The Leaflet WebView. The expand/collapse control lives *inside* the map HTML
// (see #fsbtn in mapHtml) so the WebView can't swallow the tap; it posts a
// {type:'fullscreen'} message that we turn into a Modal toggle here. Rendered
// both inline (square) and full-screen — each instance keeps its own
// zoom/layers, which is fine since they sync through the `center` prop.
function MapCanvas({
  center,
  onPick,
  windTargetISO = null,
  windTargetLabel = 'Now',
  fullscreen,
  onToggleFullscreen,
}: CanvasProps) {
  const styles = useStyles();
  const webRef = useRef<WebView>(null);
  // Latest center — read when the HTML is rebuilt for a wind-time change.
  const centerRef = useRef(center);
  centerRef.current = center;
  // True when a pin move came from a tap/drag inside the map: the map already
  // moved the view, so we must NOT re-inject (which could disturb the zoom).
  const internalPick = useRef(false);

  // Rebuild the document only when the wind hour (or this instance's fullscreen
  // flag) changes. Center changes are pushed via injectJavaScript instead, so
  // selecting a spot never reloads the WebView or resets the zoom.
  const html = useMemo(
    () => buildMapHtml(centerRef.current, windTargetISO, windTargetLabel, fullscreen),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windTargetISO, windTargetLabel, fullscreen],
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

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html }}
      style={styles.web}
      onMessage={(event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data?.type === 'fullscreen') {
            onToggleFullscreen();
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

// Native (iOS / Android) implementation. Metro automatically substitutes
// MapPicker.web.tsx when bundling for web. react-native-webview ships inside
// Expo Go, so this works without a custom dev build.
export function MapPicker(props: MapPickerProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.frame}>
      <MapCanvas {...props} fullscreen={false} onToggleFullscreen={() => setExpanded(true)} />
      <Modal
        visible={expanded}
        animationType="slide"
        onRequestClose={() => setExpanded(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <SafeAreaView style={styles.modalRoot}>
          {expanded ? (
            <MapCanvas {...props} fullscreen onToggleFullscreen={() => setExpanded(false)} />
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
  web: {
    flex: 1,
    backgroundColor: colors.bgElevated,
  },
}));
