import * as Notifications from 'expo-notifications';
import { LogBox, Platform } from 'react-native';

// expo-notifications warns on import (Android, Expo Go) that remote push
// isn't supported here — expected, see the comment on initNotifications
// below. We only use LOCAL notifications, so this is just noise.
LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * LOCAL notifications only, not real push — the app itself detects a
 * new task assignment while running and fires an alert immediately.
 * Deliberate scope decision, not an oversight: real push (arrives even
 * with the app fully closed) needs a development build (EAS Build) —
 * Expo Go on Android hasn't supported remote push since SDK 53 at all
 * (needs FCM credentials only a real build can have). This works in
 * Expo Go on both platforms today, but only while the app is open or
 * recently backgrounded — not a guarantee if it's been closed a while.
 * See docs/architecture.md if/when migrating to real push.
 */
export async function initNotifications() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  await Notifications.requestPermissionsAsync();
}
