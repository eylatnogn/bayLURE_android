import { createElement, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';

// Web implementation. Renders the shared Leaflet document inside an <iframe>
// (a real DOM element, since Expo web runs on react-dom) and listens for the
// coordinates the map posts back to the parent window.
export function MapPicker({ center, onPick }: MapPickerProps) {
  useEffect(() => {
    function handler(event: MessageEvent) {
      try {
        const data = JSON.parse(event.data);
        if (typeof data?.latitude === 'number') {
          onPick({ latitude: data.latitude, longitude: data.longitude });
        }
      } catch {
        // Ignore non-JSON messages from other sources.
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onPick]);

  const iframe = createElement('iframe', {
    srcDoc: buildMapHtml(center),
    style: {
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block',
    },
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
    maxWidth: 460,
    alignSelf: 'center',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgElevated,
  },
});
