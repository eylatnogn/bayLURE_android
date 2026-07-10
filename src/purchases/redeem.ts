// Redeem codes: unlock Pro without a Play purchase (developer / promo use).
//
// Only SHA-256 hashes ship in the bundle, so the codes themselves can't be
// read out of an APK. To revoke a code, delete its hash here (devices that
// already redeemed keep Pro until the app's storage is cleared); to add one,
// hash the new code (`printf '%s' 'CODE' | shasum -a 256`) and append it.
import AsyncStorage from '@react-native-async-storage/async-storage';

const REDEEM_HASHES = [
  // master (Elton)
  '3308146262a249ac4895080a88a1acf83a52c44468096e68c2c5d028d10d5e0e',
];

const STORAGE_KEY = 'balure.redeem.v1';

/** True if a valid code was redeemed on this device earlier. */
export async function loadRedeemed(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    // Re-validate against the current list so removing a hash revokes it.
    return !!stored && REDEEM_HASHES.includes(stored);
  } catch {
    return false;
  }
}

/**
 * Try to redeem a code. Case/whitespace-insensitive; dashes optional.
 * Persists on success so the unlock survives restarts.
 */
export async function redeemCode(input: string): Promise<boolean> {
  const normalized = input.trim().toUpperCase();
  // Codes are shown with dashes, but accept them typed without.
  const candidates = new Set([normalized, normalized.replace(/[\s-]/g, '')]);
  for (const candidate of candidates) {
    const hash = sha256Hex(candidate);
    if (REDEEM_HASHES.includes(hash)) {
      // Try the dashed canonical form too so storage matches the list.
      await AsyncStorage.setItem(STORAGE_KEY, hash).catch(() => {});
      return true;
    }
    // Also try re-inserting canonical dashes for a code typed bare:
    // BAYLURE + 3 groups of 4 hex chars.
    const bare = candidate.replace(/[\s-]/g, '');
    const m = /^BAYLURE([0-9A-F]{4})([0-9A-F]{4})([0-9A-F]{4})$/.exec(bare);
    if (m) {
      const dashed = `BAYLURE-${m[1]}-${m[2]}-${m[3]}`;
      const dashedHash = sha256Hex(dashed);
      if (REDEEM_HASHES.includes(dashedHash)) {
        await AsyncStorage.setItem(STORAGE_KEY, dashedHash).catch(() => {});
        return true;
      }
    }
  }
  return false;
}

// ---- SHA-256 (FIPS 180-4), synchronous, ASCII input ----
// Standard compact implementation; verified against `shasum -a 256`.
/* eslint-disable no-bitwise */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(ascii: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    const c = ascii.charCodeAt(i);
    if (c > 0x7f) {
      // Non-ASCII can't appear in a valid code; hash something that won't match.
      bytes.push(0xff);
    } else {
      bytes.push(c);
    }
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // 64-bit big-endian length (high 32 bits are 0 for any realistic input).
  bytes.push(0, 0, 0, 0);
  bytes.push((bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Array<number>(64);
  for (let off = 0; off < bytes.length; off += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] =
        (bytes[off + i * 4]! << 24) |
        (bytes[off + i * 4 + 1]! << 16) |
        (bytes[off + i * 4 + 2]! << 8) |
        bytes[off + i * 4 + 3]!;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + w[i]!) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
}
