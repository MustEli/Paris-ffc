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

Scaffolded (Expo + TypeScript, SDK 54), confirmed working on a real Android device via Expo Go. Navigation shell is in: mock role login (`src/navigation/screens/LoginScreen.tsx`) routes into `StaffNavigator` / `AdminNavigator` / `ManagementNavigator`, each currently showing a placeholder home screen. No real auth yet — role selection is local-only until the backend exists. Next up: a minimal backend to replace the mock login, then the Attendance feature. See [../../docs/architecture.md](../../docs/architecture.md) for the full roadmap and stack rationale.

**iOS not yet device-tested** — this dev environment has no Mac/iOS simulator. The bundle builds cleanly for the `ios` platform target, but that's not the same as confirming it renders correctly. To test: install **Expo Go** from the App Store on an iPhone and scan the same QR code `npm start` produces — it serves both platforms from one session.

## Running it

```
npm start
```
then scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network as this computer).

**Pinned to Expo SDK 54, not the npm "latest" (57).** As of mid-2026, Expo has been unable to get App Store/Play Store approval for an updated Expo Go client — the publicly installable Expo Go app is stuck on SDK 54 ([Expo's own changelog confirms this](https://expo.dev/changelog/expo-go-and-app-store-may-2026)), while `npm install expo` happily gives you SDK 57. A newer-SDK project shows *"Project is incompatible with this version of Expo Go"* on the phone regardless of how recent your installed Expo Go is — there's no newer public build to update to. Do **not** try bumping the SDK to "fix" this; if it happens again, check Expo's changelog for the current store-published SDK first, since this is a moving, Expo-side constraint, not a version mismatch you caused.

When the SDK does need to change (store catches up, or a required feature forces it), use `npx expo install expo@<version>` followed by `npx expo install --fix` — not a manual `package.json` edit — so the native-dependent packages (`react`, `react-native`, `expo-status-bar`, etc.) get realigned together.

If a feature ever needs something Expo Go itself can't do (custom native modules), the next step is a **development build** (`eas build --profile development`) instead of Expo Go — see Expo's docs on development builds.

## EAS Build (2026-08-23) — moving off Expo Go

`expo-dev-client` is installed and `eas.json` (development/preview/production profiles) is configured. This doesn't change day-to-day work at all — a development build behaves exactly like Expo Go (same `npm start`, same instant reload on save); the only difference is a custom-icon app on the phone instead of the Expo Go app. A rebuild is only needed when something **native** changes (a new native library, an `app.json` permission change, an SDK upgrade) — not for regular feature work.

**One-time setup, run by whoever owns the Expo account (these are account-bound steps, not something that can be scripted/run on someone else's behalf):**

```
npx eas-cli@latest login
```
Log in with (or create) a free Expo account.

```
npx eas-cli@latest build --platform android --profile development
```
First run will offer to link/create an EAS project for this app and generate an Android keystore — accept both defaults ("Generate a new Android Keystore? Yes", let EAS manage it). The build runs in Expo's cloud (~10-20 min); you'll get a link to download the resulting `.apk` directly to the Android phone once it finishes (Settings → allow installs from this source, since it's outside the Play Store).

**iOS builds need an Apple Developer Program membership ($99/year)** for code signing — that's an Apple requirement, not an Expo/EAS one. `ios.bundleIdentifier` is already set in `app.json` for whenever that's set up; until then, keep testing iOS via Expo Go as usual.

Once a development build is installed, run the backend + `npm start` exactly as before — the app connects to the same dev server, just via its own icon instead of Expo Go's.
