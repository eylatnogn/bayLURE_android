import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius } from '@/theme';
import { buildMapHtml, type MapPickerProps } from '@/components/mapHtml';

// Native (iOS / Android) implementation. Metro automatically substitutes
// MapPicker.web.tsx when bundling for web. react-native-webview ships inside
// Expo Go, so this works without a custom dev build.
export function MapPicker({ center, onPick }: MapPickerProps) {
  return (
    <View style={styles.frame}>
      <WebView
        originWhitelist={['*']}
        source={{ html: buildMapHtml(center) }}
        style={styles.web}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (typeof data.latitude === 'number') {
              onPick({ latitude: data.latitude, longitude: data.longitude });
            }
          } catch {
            // Ignore malformed messages.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  web: {
    flex: 1,
    backgroundColor: colors.bgElevated,
  },
});
