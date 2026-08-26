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

const BASE_PACKAGE = 'com.warehousehq.mobile';
const androidPackage = IS_DEV_BUILD ? `${BASE_PACKAGE}.dev` : BASE_PACKAGE;
const appName = IS_DEV_BUILD ? 'Warehouse HQ (Dev)' : 'Warehouse HQ';

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
          'Warehouse HQ uses the camera to capture shipping label and damage-evidence photos.',
        NSPhotoLibraryUsageDescription:
          'Warehouse HQ needs photo library access to attach an existing photo instead of using the camera.',
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
