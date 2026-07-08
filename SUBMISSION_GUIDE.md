# bayLURE — App Store & Google Play submission guide

This folder is the **store-release copy** of bayLURE, cloned from the iCloud
original (`Project/App 2/balure-app`, commit `c780735`) and upgraded for store
submission. The original folder is untouched. What changed here:

- **Expo SDK 51 → 56** (React Native 0.85, React 19.2). SDK 51 targets an
  Android API level Google Play no longer accepts for new apps; SDK 56
  (May 2026) satisfies current Play requirements and Apple's SDK rules.
- **App identity**: version `0.15.0` (matches the in-app badge and
  `src/version.ts`), slug `baylure`, bundle ID / package
  **`com.baylure.app`** on both platforms. ⚠️ The bundle ID is permanent once
  you first submit — change it now or never.
- **Store-required assets** in `assets/` (app icon, Android adaptive icon,
  splash) and `store-assets/` (Play listing icon + feature graphic). These are
  generated from the in-app logo; replace any time before submitting.
- **Code updated for SDK 56**: new `expo-image-manipulator` API, new
  `expo-image-picker` mediaTypes format, and `react-native-safe-area-context`
  (Android is now always edge-to-edge, so the old RN `SafeAreaView` would let
  content slide under the status/navigation bars).
- `ITSAppUsesNonExemptEncryption: false` (app only uses HTTPS) so Apple skips
  the export-compliance question on every build.

Everything was reviewed but **not run** (no Node on the authoring machine), so
step 1 below includes a typecheck + smoke test.

---

## Costs (unavoidable, one decision each)

| What | Cost |
|---|---|
| Apple Developer Program | **$99/year** (required for App Store) |
| Google Play developer account | **$25 one-time** |
| Expo EAS build service | Free tier: ~30 cloud builds/month, queued — enough for this |

## 0. Prerequisites

1. Install **Node LTS** (e.g. from nodejs.org or `brew install node`).
2. Create a free account at **expo.dev**.
3. Enroll at **developer.apple.com** ($99/yr) and **play.google.com/console** ($25).

## 1. Install & verify

```bash
cd baylure-release
npm install
npx expo install --fix   # aligns any dependency drift to SDK 56
npm run typecheck        # should pass with no errors
```

> **Testing note:** the Expo Go app in the stores tracks the *latest* SDK
> (57+), so it may refuse this SDK 56 project. Test with a **preview build**
> (step 3) or run `npm run web` for a quick sanity check.

## 2. Link the project to EAS

```bash
npm install -g eas-cli
eas login
eas init        # creates the EAS project and writes projectId into app.json
```

## 3. Preview builds (test on real devices, free)

```bash
npm run build:preview
```

- **Android** → downloads an installable `.apk`; sideload onto any Android phone.
- **iOS** → simulator build; or use TestFlight via a production build (step 4).

Verify: location fetch, map (pin drop, wind/depth toggles), 7-day + hourly
forecast, catch log with photo, both light/dark themes, and that nothing sits
under the Android status bar or gesture bar (edge-to-edge is new).

## 4. iOS — App Store

1. `npm run build:ios` — EAS generates signing certs on first run (log in with
   your Apple ID when prompted).
2. In **App Store Connect** → New App: platform iOS, name **bayLURE**, bundle
   ID `com.baylure.app`, SKU e.g. `baylure-001`.
3. `npm run submit:ios` uploads the build; then pick it in App Store Connect
   and use **TestFlight** to test on your phone before release.
4. Listing: copy from [STORE_LISTING.md](STORE_LISTING.md). **Screenshots
   required**: 6.9" iPhone (1320×2868). Because `supportsTablet` is true, a
   13" iPad set (2064×2752) is also required — if you don't want to produce
   iPad screenshots, set `"supportsTablet": false` in app.json before building.
5. **App Privacy** (nutrition label): declare **Location → App functionality →
   Not linked to identity → No tracking**. Photos and the catch log never
   leave the device, so they are *not collected*. See
   [PRIVACY_POLICY.md](PRIVACY_POLICY.md) — you must host it at a public URL
   (your Vercel site works) and paste that URL into the form.
6. Age rating: 4+. Pricing: Free. Submit for review (typically 1–2 days).

## 5. Android — Google Play

1. `npm run build:android` — produces an `.aab`.
2. In **Play Console** → Create app: name **bayLURE**, free, app (not game).
3. **Upload the first `.aab` manually** in the Console (Release → Production
   or Testing → create release). Later releases can use `npm run submit:android`
   (needs a Google service-account JSON — follow the prompt / Expo's
   "Submitting to Google Play" docs).
4. **Data safety form**: Location → collected, **processed ephemerally**
   (sent to weather/tide services to fetch conditions, never stored), purpose
   App functionality, collection optional. Because of AdMob also declare:
   **Device or other IDs → collected by third party (Google), purpose
   Advertising**. In App content, mark **"Contains ads"** — Play cross-checks
   this against the detected AdMob SDK.
5. Content rating questionnaire → Everyone. App access → all features
   available without login. Privacy policy → same hosted URL.
6. ⚠️ **New personal developer accounts must run a closed test with at least
   12 testers for 14 continuous days before production access is granted.**
   Plan for this: friends/family, or register as an organization (D-U-N-S
   number) to be exempt. Listing assets: `store-assets/play-icon-512.png` and
   `store-assets/feature-graphic-1024x500.png`, plus 2+ phone screenshots.

## 5b. Ads (AdMob)

Configured: Android app ID `ca-app-pub-2923543385163788~3293892067`, banner
unit `ca-app-pub-2923543385163788/4082148564`, anchored above the tab bar.

> ⚠️ `react-native-google-mobile-ads` is pinned to **exactly 15.8.3**: v16
> bundles play-services-ads 25.x, whose Kotlin 2.3 binaries fail to compile
> on Expo SDK 56's toolchain (broke the Android build twice). Revisit the pin
> when upgrading to a newer Expo SDK.

- **Dev and preview builds always show Google's test banner.** Real ads serve
  only from `eas build --profile production` (the profile sets
  `EXPO_PUBLIC_REAL_ADS`). Never tap live ads in your own published app —
  that's invalid-traffic territory and gets AdMob accounts suspended.
- **app-ads.txt** (required for full earnings): on the website you list as
  the developer site in Play, serve a file at `/app-ads.txt` with this line:
  `google.com, pub-2923543385163788, DIRECT, f08c47fec0942fa0`
  (a one-file addition to your Vercel site).
- **After the app is live on Play**: AdMob → your app → link it to the Play
  listing, then wait for AdMob's app review; real fill starts after that.
- ⚠️ **Before ever building iOS with ads**: create an iOS app in AdMob and
  add `iosAppId` next to `androidAppId` in app.json — the Google SDK crashes
  an iOS app at launch if it's present without its app ID. Also expect the
  App Store privacy label to gain "Identifiers → used for advertising".

## 6. Before you ship — read API_LICENSING.md

The app's data sources are now primarily US-government APIs (NWS weather,
NOAA water/tides, USGS map tiles, FCC state lookup) — free, keyless, and
**commercial-use OK**, so ads/monetization don't violate any terms. The few
remaining community sources and their light-use policies are covered in
[API_LICENSING.md](API_LICENSING.md).

## 7. Releasing updates

- Marketing version: bump `"version"` in app.json (e.g. `1.1.0`).
- Build numbers auto-increment on EAS (`appVersionSource: remote`).
- Rebuild + resubmit: `npm run build:ios && npm run submit:ios` (same for
  android). Consider `expo-updates` later for over-the-air JS fixes without
  store review.
