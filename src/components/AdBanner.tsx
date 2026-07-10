import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { usePro } from '@/purchases/pro';

// AdMob app ca-app-pub-2923543385163788~3293892067 (Android). There is no
// AdMob iOS app yet, so iOS renders no ad — create one and add `iosAppId` to
// the app.json plugin before shipping ads on iOS (the SDK crashes at launch
// on iOS without its app ID configured).
const ANDROID_BANNER_UNIT = 'ca-app-pub-2923543385163788/4082148564';

// Real ads ONLY in store builds (eas.json production profile sets
// EXPO_PUBLIC_REAL_ADS). Dev and preview builds always show Google's test
// banner — tapping your own live ads gets an AdMob account suspended.
const adUnitId =
  process.env.EXPO_PUBLIC_REAL_ADS === '1' && Platform.OS === 'android'
    ? ANDROID_BANNER_UNIT
    : TestIds.ADAPTIVE_BANNER;

/** The bottom banner, anchored above the tab bar. Android-only for now. */
export function AdBanner() {
  const [ready, setReady] = useState(false);
  // The layout gives the banner NO space until an ad has actually rendered —
  // otherwise an unfilled request (common while a new app ramps up in AdMob)
  // leaves a blank bar where the ad would sit.
  const [loaded, setLoaded] = useState(false);
  // Pro subscribers get an ad-free app.
  const { isPro } = usePro();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    mobileAds()
      .initialize()
      .then(() => setReady(true))
      .catch(() => {
        // Ads are a nice-to-have; the app runs fine without them.
      });
  }, []);

  if (Platform.OS !== 'android' || !ready || isPro) return null;

  return (
    <View
      style={
        loaded
          ? { alignItems: 'center' }
          : // Keep the request alive but collapse the space until it fills.
            { height: 0, overflow: 'hidden' }
      }
    >
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        // Non-personalized requests keep us out of consent-framework
        // requirements while distribution is US-only.
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}
