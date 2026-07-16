import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File as CacheFile, Paths } from 'expo-file-system';
import { base64ToBytes } from '@/utils/exif';

/**
 * Share a catch photo. On iOS/Android this opens the system share sheet
 * (Messages, Instagram, AirDrop, Save Image…); on web it uses the Web Share
 * API when the browser supports sharing files, falling back to a download.
 *
 * `uri` is a `CatchRecord.photoUri`: a `file://` URI on native, or a
 * `data:image/...` URL (web, or a photo that came in through a backup import).
 * Returns false when nothing could be offered (sharing unavailable / an error).
 */
export async function sharePhoto(uri: string): Promise<boolean> {
  const name = `baylure-catch-${new Date().toISOString().slice(0, 10)}.jpg`;

  if (Platform.OS === 'web') {
    return shareOnWeb(uri, name);
  }

  try {
    if (!(await Sharing.isAvailableAsync())) return false;
    // A file:// URI shares as-is; a data URL (from an imported backup) has to
    // be written to a real file first before the share sheet can take it.
    let fileUri = uri;
    if (uri.startsWith('data:')) {
      const base64 = uri.slice(uri.indexOf(',') + 1);
      const file = new CacheFile(Paths.cache, name);
      try {
        file.create();
      } catch {
        // A temp from an earlier share today already exists — write() overwrites.
      }
      file.write(base64ToBytes(base64));
      fileUri = file.uri;
    }
    await Sharing.shareAsync(fileUri, {
      mimeType: 'image/jpeg',
      dialogTitle: 'Share your catch',
      UTI: 'public.jpeg',
    });
    return true;
  } catch {
    return false;
  }
}

async function shareOnWeb(uri: string, name: string): Promise<boolean> {
  try {
    const blob = await (await fetch(uri)).blob();
    const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'My bayLURE catch' });
      return true;
    }
    // No file sharing in this browser — download the image instead.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
