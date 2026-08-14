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

Scaffolded (Expo + TypeScript, SDK 56). No screens/features built yet beyond the placeholder `App.tsx` — next up is the navigation shell. See [../../docs/architecture.md](../../docs/architecture.md) for the roadmap and stack rationale.

## Running it

```
npm start
```
then scan the QR code with the **Expo Go** app on your phone (same Wi-Fi network as this computer).

**Pinned to Expo SDK 56, not the npm "latest" (57).** Freshly-scaffolded Expo projects grab the newest SDK from npm, but the Expo Go client app on the App/Play Store lags behind — it takes days to weeks after an SDK release before the public Expo Go build actually supports it. Scanning the QR code with a mismatched Expo Go gives: *"Project is incompatible with this version of Expo Go."* SDK 56 is the previous stable release and is safe for the installed Expo Go client. When bumping the SDK later, use `npx expo install expo@<version>` followed by `npx expo install --fix` (not a manual `package.json` edit) so all the native-dependent packages (`react`, `react-native`, `expo-status-bar`, etc.) get realigned together — don't just bump `expo` by itself.
