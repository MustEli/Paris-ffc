# mobile

Staff & Admin native app — Android + iOS.

- **Framework:** React Native via Expo, TypeScript.
- **Consumes:** `@warehouse-hq/shared` for types and the API client.
- **Covers (per requirements doc):**
  - Staff interface: task list, audible notifications, status updates.
  - Admin interface: activity overview, task assignment, messaging.
  - Shift attendance (clock-in/out), reception logging, seller-stock intake, put-away, order prep.
- Localization: French + English (staff/admin).

## Status

Scaffolded (Expo + TypeScript, SDK 54). No screens/features built yet beyond the placeholder `App.tsx` — next up is the navigation shell. See [../../docs/architecture.md](../../docs/architecture.md) for the roadmap and stack rationale.

## Running it

```
npm start
```
then scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network as this computer).

**Pinned to Expo SDK 54, not the npm "latest" (57).** As of mid-2026, Expo has been unable to get App Store/Play Store approval for an updated Expo Go client — the publicly installable Expo Go app is stuck on SDK 54 ([Expo's own changelog confirms this](https://expo.dev/changelog/expo-go-and-app-store-may-2026)), while `npm install expo` happily gives you SDK 57. A newer-SDK project shows *"Project is incompatible with this version of Expo Go"* on the phone regardless of how recent your installed Expo Go is — there's no newer public build to update to. Do **not** try bumping the SDK to "fix" this; if it happens again, check Expo's changelog for the current store-published SDK first, since this is a moving, Expo-side constraint, not a version mismatch you caused.

When the SDK does need to change (store catches up, or a required feature forces it), use `npx expo install expo@<version>` followed by `npx expo install --fix` — not a manual `package.json` edit — so the native-dependent packages (`react`, `react-native`, `expo-status-bar`, etc.) get realigned together.

If a feature ever needs something Expo Go itself can't do (custom native modules), the next step is a **development build** (`eas build --profile development`) instead of Expo Go — see Expo's docs on development builds.
