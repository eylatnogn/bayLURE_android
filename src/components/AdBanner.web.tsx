// The AdMob SDK is native-only; the web build renders no banner (and must not
// import react-native-google-mobile-ads at all — this file shadows the native
// implementation via Metro's .web resolution).
export function AdBanner() {
  return null;
}
