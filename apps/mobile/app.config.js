// Dynamic config (JS, not static app.json) specifically so the
// development build can get its own Android package / iOS bundle ID
// and app name, distinct from preview/production. Without this, every
// build profile shared the same identity — installing one silently
// replaced the other on a phone, since Android/iOS treat matching
// package names as the same app. EAS sets EAS_BUILD_PROFILE during a
// real cloud build; it's unset for local `expo start`/Expo Go, which
// don't care about package name/bundle ID at all, so this only affects
// real EAS builds.
const IS_DEV_BUILD = process.env.EAS_BUILD_PROFILE === 'development';

// Package name/bundle ID deliberately left as-is (not renamed to match
// "ELNO") — changing it would orphan every already-installed build
// (same "installing one wipes the other" problem this file was created
// to solve in the first place), and nothing about the app's technical
// identity needs to match its display name. Only user-facing text
// (name, permission descriptions) changed.
//
// This `hm-el` branch is a parallel UX-redesign fork being compared
// side by side against the `master` branch's app ("Elno-P" in the
// user's own shorthand for the two versions; this one is "Hm-El") —
// same backend, same display name ("ELNO"), deliberately NOT renamed
// per the user's instruction (whichever version wins keeps the ELNO
// name). Only the package identity differs, specifically so this
// build can be installed on the same phone as master's build without
// silently overwriting it — the display name alone can't do that,
// Android/iOS dedupe by package identity, not by name.
const BASE_PACKAGE = 'com.warehousehq.mobile.hmel';
const androidPackage = IS_DEV_BUILD ? `${BASE_PACKAGE}.dev` : BASE_PACKAGE;
const appName = IS_DEV_BUILD ? 'ELNO (Dev)' : 'ELNO';

module.exports = {
  expo: {
    name: appName,
    slug: 'warehouse-hq-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: androidPackage,
      infoPlist: {
        NSCameraUsageDescription:
          'ELNO uses the camera to capture shipping label and damage-evidence photos, and to scan tracking ID barcodes.',
        NSPhotoLibraryUsageDescription:
          'ELNO needs photo library access to attach an existing photo instead of using the camera.',
      },
    },
    android: {
      package: androidPackage,
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['CAMERA'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      eas: {
        projectId: 'ab3c5ff5-673d-4633-8e09-1335b3197a95',
      },
    },
  },
};
