/**
 * Photo metadata (EXIF) extraction for the catch log: when a photo is added
 * to a catch, its embedded date/time and GPS position pre-fill the "caught
 * on" date, the exact conditions timestamp, and the location — the angler
 * can still override everything by hand.
 *
 * Two sources, best-effort:
 * - Native: expo-image-picker returns a parsed `exif` object with the asset.
 * - Web: the picker gives no EXIF, so a small JPEG/TIFF parser reads the
 *   APP1 segment straight from the image bytes.
 */

export interface PhotoMeta {
  /** When the photo was taken (local time), or null if not recorded. */
  takenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

const NO_META: PhotoMeta = { takenAt: null, latitude: null, longitude: null };

/** Parse EXIF's "YYYY:MM:DD HH:MM:SS" into a local Date. */
function parseExifDate(s: unknown): Date | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const d = new Date(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6]),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Coerce a picker GPS value (number, numeric string, or DMS array) to degrees. */
function toDegrees(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
    // Some Android builds hand back "d/1,m/1,s/100" rational strings.
    const parts = v.split(',').map((p) => {
      const [num = NaN, den = NaN] = p.split('/').map(Number);
      return Number.isFinite(num) ? (Number.isFinite(den) && den ? num / den : num) : NaN;
    });
    if (parts.length === 3 && parts.every(Number.isFinite)) {
      return parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
    }
  }
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number')) {
    return (v[0] as number) + (v[1] as number) / 60 + (v[2] as number) / 3600;
  }
  return null;
}

/**
 * Metadata from expo-image-picker's `exif` field (native platforms). Handles
 * both iOS's flat keys and nested `{Exif}` / `{GPS}` dictionaries.
 */
export function metaFromPickerExif(exif: Record<string, unknown> | null | undefined): PhotoMeta {
  if (!exif) return NO_META;
  const nestedExif = (exif['{Exif}'] ?? {}) as Record<string, unknown>;
  const nestedGps = (exif['{GPS}'] ?? {}) as Record<string, unknown>;

  const takenAt =
    parseExifDate(exif['DateTimeOriginal']) ??
    parseExifDate(nestedExif['DateTimeOriginal']) ??
    parseExifDate(exif['DateTimeDigitized']) ??
    parseExifDate(exif['DateTime']);

  let latitude = toDegrees(exif['GPSLatitude'] ?? nestedGps['Latitude']);
  let longitude = toDegrees(exif['GPSLongitude'] ?? nestedGps['Longitude']);
  const latRef = (exif['GPSLatitudeRef'] ?? nestedGps['LatitudeRef']) as string | undefined;
  const lonRef = (exif['GPSLongitudeRef'] ?? nestedGps['LongitudeRef']) as string | undefined;
  if (latitude != null && latRef === 'S' && latitude > 0) latitude = -latitude;
  if (longitude != null && lonRef === 'W' && longitude > 0) longitude = -longitude;
  if (
    latitude == null || longitude == null ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)
  ) {
    latitude = null;
    longitude = null;
  }
  return { takenAt, latitude, longitude };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Pure-JS base64 → bytes (no atob/Buffer, works on Hermes, web, and Node). */
export function base64ToBytes(b64: string): Uint8Array {
  // Strip any data-URL prefix and whitespace/padding.
  const raw = (b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64).replace(/[\s=]+$/g, '');
  const out = new Uint8Array(Math.floor((raw.length * 3) / 4));
  let buf = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = B64.indexOf(raw[i]!);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return o === out.length ? out : out.slice(0, o);
}

/**
 * Minimal EXIF reader for JPEG bytes (web fallback): finds the APP1 "Exif"
 * segment and pulls DateTimeOriginal + GPS out of the TIFF structure. Returns
 * empty metadata on anything unexpected — never throws.
 */
export function metaFromJpegBytes(bytes: Uint8Array): PhotoMeta {
  try {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return NO_META;
    // Walk JPEG segments looking for APP1/Exif.
    let off = 2;
    let tiff = -1;
    while (off + 4 <= bytes.length) {
      if (bytes[off] !== 0xff) break;
      const marker = bytes[off + 1]!;
      if (marker === 0xda) break; // start of scan — no EXIF past here
      const size = (bytes[off + 2]! << 8) + bytes[off + 3]!;
      if (marker === 0xe1 && size >= 8) {
        // "Exif\0\0" then the TIFF header.
        if (
          bytes[off + 4] === 0x45 && bytes[off + 5] === 0x78 &&
          bytes[off + 6] === 0x69 && bytes[off + 7] === 0x66
        ) {
          tiff = off + 10;
          break;
        }
      }
      off += 2 + size;
    }
    if (tiff < 0 || tiff + 8 > bytes.length) return NO_META;

    const little = bytes[tiff] === 0x49; // 'II' little-endian vs 'MM'
    const u16 = (p: number) =>
      little ? bytes[p]! + (bytes[p + 1]! << 8) : (bytes[p]! << 8) + bytes[p + 1]!;
    const u32 = (p: number) =>
      little
        ? bytes[p]! + (bytes[p + 1]! << 8) + (bytes[p + 2]! << 16) + bytes[p + 3]! * 0x1000000
        : bytes[p]! * 0x1000000 + (bytes[p + 1]! << 16) + (bytes[p + 2]! << 8) + bytes[p + 3]!;

    /** Read one IFD into tag → {type, count, valueOffset} entries. */
    function readIfd(start: number): Map<number, { type: number; count: number; at: number }> {
      const out = new Map<number, { type: number; count: number; at: number }>();
      if (start < 0 || tiff + start + 2 > bytes.length) return out;
      const n = u16(tiff + start);
      for (let i = 0; i < n; i++) {
        const e = tiff + start + 2 + i * 12;
        if (e + 12 > bytes.length) break;
        const tag = u16(e);
        const type = u16(e + 2);
        const count = u32(e + 4);
        // Values >4 bytes live at a pointed-to offset; small ones sit inline.
        const size = (type === 3 ? 2 : type === 4 || type === 9 ? 4 : type === 5 || type === 10 ? 8 : 1) * count;
        const at = size > 4 ? tiff + u32(e + 8) : e + 8;
        out.set(tag, { type, count, at });
      }
      return out;
    }

    const ascii = (v: { count: number; at: number }) => {
      let s = '';
      for (let i = 0; i < v.count - 1 && v.at + i < bytes.length; i++) {
        s += String.fromCharCode(bytes[v.at + i]!);
      }
      return s;
    };
    const rationals = (v: { count: number; at: number }) => {
      const out: number[] = [];
      for (let i = 0; i < v.count; i++) {
        const p = v.at + i * 8;
        if (p + 8 > bytes.length) break;
        const den = u32(p + 4);
        out.push(den ? u32(p) / den : u32(p));
      }
      return out;
    };
    const dms = (v: { count: number; at: number } | undefined) => {
      if (!v) return null;
      const r = rationals(v);
      if (r.length !== 3 || !r.every(Number.isFinite)) return null;
      return r[0]! + r[1]! / 60 + r[2]! / 3600;
    };

    const ifd0 = readIfd(u32(tiff + 4));
    const exifIfd = ifd0.get(0x8769);
    const gpsIfd = ifd0.get(0x8825);
    const exifTags = exifIfd ? readIfd(u32(exifIfd.at)) : new Map();
    const gpsTags = gpsIfd ? readIfd(u32(gpsIfd.at)) : new Map();

    const dt = exifTags.get(0x9003) ?? exifTags.get(0x9004) ?? ifd0.get(0x0132);
    const takenAt = dt ? parseExifDate(ascii(dt)) : null;

    let latitude = dms(gpsTags.get(0x0002));
    let longitude = dms(gpsTags.get(0x0004));
    const latRef = gpsTags.get(0x0001);
    const lonRef = gpsTags.get(0x0003);
    if (latitude != null && latRef && ascii(latRef) === 'S') latitude = -latitude;
    if (longitude != null && lonRef && ascii(lonRef) === 'W') longitude = -longitude;
    if (
      latitude == null || longitude == null ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
      (latitude === 0 && longitude === 0)
    ) {
      latitude = null;
      longitude = null;
    }
    return { takenAt, latitude, longitude };
  } catch {
    return NO_META;
  }
}
