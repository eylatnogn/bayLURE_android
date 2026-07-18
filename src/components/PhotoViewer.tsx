import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { sharePhoto } from '@/utils/sharePhoto';
import { makeStyles, pressedStyle, radius, spacing, useTheme } from '@/theme';

interface Props {
  /** The photo to show full-screen; null keeps the viewer closed. */
  uri: string | null;
  onClose: () => void;
}

/**
 * Full-screen, immersive photo viewer for a logged catch — tap a thumbnail to
 * open it big, then share it to Messages / Instagram / the camera roll (native)
 * or via the browser's share/download (web). Always dark, regardless of theme.
 */
export function PhotoViewer({ uri, onClose }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState(false);
  const [failed, setFailed] = useState(false);

  // Clear any prior "couldn't share" notice each time a new photo opens.
  useEffect(() => {
    if (uri) setFailed(false);
  }, [uri]);

  const onShare = async () => {
    if (!uri || sharing) return;
    setSharing(true);
    setFailed(false);
    const ok = await sharePhoto(uri);
    setSharing(false);
    if (!ok) setFailed(true);
  };

  return (
    <Modal
      visible={uri != null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tapping the dark area closes; the image and buttons sit on top. */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {uri ? <Image source={{ uri }} style={styles.image} resizeMode="contain" /> : null}

        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconBtn,
            { top: insets.top + spacing.sm },
            pressed && pressedStyle,
          ]}
        >
          <Feather name="x" size={22} color="#fff" />
        </Pressable>

        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.lg }]}>
          {failed ? <Text style={styles.error}>Couldn’t share that photo.</Text> : null}
          <Pressable
            onPress={onShare}
            disabled={sharing}
            style={({ pressed }) => [styles.shareBtn, pressed && pressedStyle]}
          >
            {sharing ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <>
                <Feather name="share" size={18} color={colors.onAccent} />
                <Text style={styles.shareText}>
                  {Platform.OS === 'web' ? 'Share / Save' : 'Share'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  iconBtn: {
    position: 'absolute',
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    minWidth: 140,
    justifyContent: 'center',
  },
  shareText: {
    color: c.onAccent,
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    color: '#fff',
    fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
}));
