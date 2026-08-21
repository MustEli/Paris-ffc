# Architecture & Stack Decision

Status: **decided**. This resolves the open "React Native or Flutter?" question left at the end of the prior session.

## Context

Warehouse HQ is a mobile app (Android + iOS) for a secondhand car parts marketplace's warehouse operations: staff attendance, task assignment, scheduling, reception intake, seller-stock handling, order preparation, and management reporting. Full functional requirements live in [requirements/Elnaaz things.pdf](requirements/Elnaaz%20things.pdf). The project previously existed only as a static-HTML PWA prototype ([legacy-pwa-prototype/](legacy-pwa-prototype/)) which did not meet the requirements doc's "native app" and MDM white-listing needs, and has been superseded by this structure.

## Decision: React Native (Expo) + TypeScript, over Flutter

| Factor | Why it favors React Native/Expo here |
|---|---|
| Language surface | Backend, web dashboard, and shared types are all TypeScript. RN keeps the *entire* stack in one language — no Dart context-switch — which matters given the doc's stated intent to keep adding features over time. |
| Shared types | A `shared` package of TS interfaces (User, Shift, Reception, Task, …) can be imported directly by mobile, web-dashboard, and backend. Flutter can't consume TS types directly. |
| Iteration speed | Expo's managed workflow + OTA updates suit a fast-moving, still-being-defined spec (the doc itself has unfinished sections — Returns/Errors, outgoing flow, reporting). |
| Native requirements coverage | Camera (label/damage photos), geolocation (geofencing for clock-in), push (FCM/APNs), audio alerts, background timers — all reachable via Expo modules or a bare-workflow eject if a custom MDM SDK is ultimately required. |
| Ecosystem | Larger pool of JS/TS warehouse/logistics app examples and libraries (barcode scanning, offline sync) than Dart equivalents. |

Flutter remains a reasonable alternative (better raw UI performance, single rendering engine across platforms) but was not chosen, to avoid fragmenting the team across two languages for no requirement that strictly needs it.

## Full stack

- **Mobile app** (Staff + Admin): React Native, Expo, TypeScript.
- **Web dashboard** (Management reporting/analytics, English-only per spec): React + TypeScript + Vite.
- **Backend API**: NestJS + TypeScript + TypeORM.
- **Database**: PostgreSQL (transactional: shifts, receptions, tasks, audit logs).
- **Cache / real-time fan-out**: Redis + Socket.IO (task assignments, admin push instructions, audible-alert triggers).
- **Push notifications**: Firebase Cloud Messaging (Android) + APNs (iOS).
- **Offline & local storage**: SQLite via WatermelonDB, with a sync queue for warehouse dead zones.
- **Auth**: JWT + role-based access control (Staff / Admin / Management / IT-Infra), device-metadata check at login for MDM compliance.
- **CI/CD**: GitHub Actions + EAS Build (mobile), Fastlane if bare-workflow native modules are later required.
- **Infra**: Terraform-managed (`infra/`), targeting a managed Postgres + container host (exact provider TBD — not needed until deployment).
- **Monitoring**: Sentry (crash/error), basic log aggregation once a backend exists.

## Monorepo layout

```
app-project/
├── apps/
│   ├── mobile/          # React Native (Expo) — Staff + Admin app
│   └── web-dashboard/   # React — Management reporting
├── packages/
│   ├── backend/         # NestJS API
│   └── shared/          # Cross-app TS types + API client
├── infra/               # Terraform / IaC (empty until deployment is scoped)
├── docs/
│   ├── requirements/    # Source requirements doc(s)
│   ├── legacy-pwa-prototype/  # Retired static PWA mockup, kept for reference
│   └── architecture.md  # This file
├── package.json         # npm workspaces root
└── tsconfig.base.json
```

Each `apps/*` and `packages/*` folder currently holds only a `package.json` + `README.md` describing its intended contents — no framework has been scaffolded yet (no `npx create-expo-app`, no `nest new`), per instruction to structure first, build later.

## Mobile app internal architecture

`apps/mobile/src` is organized **by feature**, mirroring the requirements doc's own Feature 0–5 structure 1:1, so there's always an obvious place for new spec sections to land:

```
apps/mobile/
├── App.tsx / index.ts       # Expo/Metro entry point (fixed location, not movable into src/)
└── src/
    ├── navigation/           # role-based routing root + stacks
    │   ├── RootNavigator.tsx      # picks Auth/Staff/Admin/Management stack by role
    │   ├── AuthNavigator.tsx, StaffNavigator.tsx, AdminNavigator.tsx, ManagementNavigator.tsx
    │   └── screens/          # navigation-shell screens (Login, per-role placeholder homes)
    ├── features/
    │   ├── attendance/
    │   │   ├── screens/        # ShiftScreen.tsx
    │   │   ├── components/     # StartShiftButton.tsx
    │   │   ├── hooks/          # useShiftStatus.ts
    │   │   └── api.ts          # calls into core/api
    │   ├── reception/
    │   ├── sellerStock/
    │   ├── putAway/
    │   └── orderPrep/
    ├── core/
    │   ├── api/                 # shared HTTP client, auth headers
    │   ├── auth/                # authStore.ts — role state (mock login for now, see Status)
    │   ├── notifications/       # push + audible alert wiring
    │   ├── offline/              # sync queue for poor warehouse connectivity
    │   ├── i18n/                 # French/English strings
    │   └── theme/
    └── components/               # shared dumb UI (buttons, cards) used across features
```

Each `features/*` folder is self-contained — Attendance can be built, tested, and shipped without Reception existing yet. `core/` holds the cross-cutting concerns every feature needs. Once a role's real feature screens exist, they replace that role stack's placeholder home screen — the navigation shell doesn't change shape, it just stops pointing at a placeholder.

**Library choices:**

| Concern | Choice | Why |
|---|---|---|
| Navigation | React Navigation | Standard, supports role-based stacks cleanly |
| Server state (data from the API) | TanStack Query | Caching, retry, and offline-aware refetching for free |
| Local/UI state | Zustand | Minimal boilerplate for ephemeral UI state |
| Offline storage | AsyncStorage + React Query persistence first; WatermelonDB only if sync conflicts get complex | Don't build for complexity that doesn't exist yet |
| Auth token storage | expo-secure-store | Encrypted on-device JWT storage |
| Camera (label/damage photos) | expo-camera / expo-image-picker | Required by Reception & Seller Stock |
| Location (future geofencing) | expo-location | Matches the doc's "Future developments" section |
| Push + audible alerts | expo-notifications + expo-av | Doc requires distinct audible alerts, not silent push |
| i18n | react-i18next | French/English requirement for staff/admin |

## Domain model (from requirements doc)

`User`, `Role` (Staff/Admin/Management/IT), `Device`, `Shift`, `Break`, `Reception` (categories: Return Parcels, Packaging Stock, Sellers Stock, Equipment/Other), `SellerStockPallet` (weight, condition, damage evidence), `PutAwayTask`, `PickPackTask`, `AuditLog`.

## Open / unresolved in the source spec

These sections in the requirements doc are stubs (headers only, no detail) and will need clarification before the corresponding domain models/screens can be designed:
- Returns and Errors Documentation
- Outgoing flow / return process ("Onglet 7")
- Reporting and visualisation ("Onglet 9")

## Build roadmap (vertical slices)

Built one thin slice at a time — a feature working screen-to-database — rather than building out the full architecture before anything runs. Each step below is a prerequisite for the next:

1. **Scaffold `apps/mobile`** with Expo + TypeScript, confirm it renders on a real device via Expo Go. *(done — see Status below)*
2. **Navigation shell** — login screen + role-based routing stub (Staff / Admin / Management land on separate empty screens). *(done — see Status below)*
3. **Minimal backend in parallel** — just enough NestJS endpoints to support step 4 (login, start-shift, end-shift, shift-status), not the full domain model yet. *(done — see Status below)*
4. **Attendance feature end-to-end** (Feature 1 — smallest, most fully-specified in the doc): one real screen, one real button, one real API call, one real database row. Proves the whole stack holds together. *(done — see Status below)*
5. **Offline handling + push notifications**, retrofitted onto the now-working Attendance slice.
6. **Repeat the pattern** for Reception → Seller Stock → Put-Away → Order Preparation, reusing the auth/navigation/offline/notifications plumbing built in steps 2–5. *(Reception and Seller Stock done — see Status below; Put-Away / Order Prep not started)*
7. **EAS Build** for real device installs and MDM white-list testing, once there's something worth installing.

## Status

- `apps/mobile`: Expo + TypeScript scaffold, pinned to SDK 54 (steps 1–2 of the roadmap above). Confirmed working end-to-end on both a real Android device and a real iPhone via Expo Go.
- Navigation shell in place, confirmed on a real Android device: `RootNavigator` switches between `AuthNavigator` and a `StaffNavigator` / `AdminNavigator` / `ManagementNavigator`, each showing a placeholder home screen (Staff's is now the real Attendance screen — see below) and a logout button.
- `packages/backend`: NestJS scaffold with real (if intentionally minimal) `auth` and `shifts` modules — JWT login against 3 seeded dev users, and a working start/end/status shift lifecycle with correct conflict handling (409 on double-start, 404 on double-end). **In-memory storage, not Postgres yet** — a deliberate scope decision, see `packages/backend/README.md` Status for why and what swapping to Postgres later involves. Verified via a passing Jest e2e suite (4/4) plus manual curl exercise of the full flow, not just type-checked.
- **Attendance feature (roadmap step 4) built:** `apps/mobile`'s login is now real — `core/auth/authStore.ts` calls `POST /auth/login` and holds the JWT (in-memory only, not persisted across app restarts yet). `features/attendance/` (TanStack Query `useShiftStatus` hook + `ShiftScreen`) is the Staff role's home screen: Start/End Shift button backed by the real endpoints, showing local-time "on shift since" status. `core/api/client.ts` resolves the backend's LAN IP by reusing Expo's own `Constants.expoConfig.hostUri` — the same address the phone already reaches Metro at — so there's no separate network config to get wrong.
- **Confirmed on a real Android device (2026-08-14):** full login → Start Shift → status → End Shift flow, against the real backend over the phone's own hotspot network. This is the first fully real vertical slice, screen-to-server, working end-to-end — not just type-checked or bundle-verified. (Getting here required one inbound firewall rule for TCP 3000, since the hotspot Wi-Fi is a Public-profile network — see `packages/backend/README.md` if this needs redoing on another machine/network.)
- **Reception feature (roadmap step 6, Feature 2) built:** backend gained a `receptions` module (create/list/get + admin-only `instructions` + `complete`, enforced by a new reusable `RolesGuard`/`@Roles()` — the first role-gated endpoint) and mobile gained `features/reception/` (NewDeliveryScreen's 4-category form, ReceptionListScreen "real-time log", ReceptionDetailScreen shared between Staff and Admin with role-conditional actions). Staff and Admin navigators are now hub screens (`MenuScreen`) linking into their modules, rather than a single placeholder.
  - **Deliberately cut for this slice** (documented in code comments, not silently dropped): Sellers Stock category only collects pallet count — full weight/condition/damage branching is genuinely Feature 3, a separate future roadmap item; Equipment/Other's required "photo of what received" isn't implemented (no camera capture yet); the 2-hour review-flag (doc Step 5, itself marked "Optional" in the doc) is computed and stored but has no dedicated flagged-items view yet, just an inline badge.
- **Confirmed on both a real Android device and a real iPhone (2026-08-14):** Attendance and Reception both work end-to-end on both platforms via Expo Go, over the same Wi-Fi hotspot network. iOS testing required one topology fix — see the hotspot note below — otherwise no code changes were needed for iOS to work.
- **Seller Stock feature (roadmap step 6, Feature 3) built:** the first feature with real camera capture (`expo-image-picker`) — backend gained a generic `uploads` module (local-disk storage for now, see `packages/backend/README.md`) and a `seller-stock` module (weight/condition branching: damaged or over 700kg auto-flags `pending_admin_review`; otherwise `ready_for_putaway`; both converge on admin giving a put-away location, then staff confirms placement). Mobile gained `features/sellerStock/` — `PhotoCaptureButton`/`DamageEvidenceCapture` components (camera → immediate upload → thumbnail preview), `NewPalletScreen`, and list/detail screens following the same shared-between-roles pattern as Reception. `app.json` gained iOS/Android camera permission descriptions (inert in Expo Go itself, which uses its own bundled permissions, but required once this moves to a real EAS build).
  - **Deliberately not modeled** (doc Step 4, "batch completion" grouping multiple pallets into one documentation-complete action): each pallet is its own record; logging several in a row achieves the same practical result without a separate batch entity.
- **Confirmed on-device (2026-08-21), then refined:** user tested Seller Stock (after a break — everything from prior sessions still worked, no drift) and asked for multi-photo support on the label field (was single-photo-only; damage evidence already supported multiple). `labelPhotoUrl` → `labelPhotoUrls[]` across backend and mobile, with a shared `MAX_PHOTOS_PER_FIELD` (6) cap enforced server-side, not just in the UI. `PhotoCaptureButton` (single capture+upload primitive) is now composed by a generalized `MultiPhotoCapture` component used for both the label and damage-evidence fields.
  - Verified: backend e2e 15/15 passing, `tsc` clean (both packages), real android+ios bundles build.
- **Photo upload bug found and fixed on-device (2026-08-21):** uploading a full-resolution camera photo failed with a misleading "could not reach the server" — the real cause (revealed only after fixing the error handling to stop masking it) was React Native's fetch/FormData bridge choking on large images, unrelated to networking. Fixed with `core/media/compressImage.ts` (resize to 1280px + recompress via `expo-image-manipulator`) before every upload. Confirmed working on-device after the fix — **Seller Stock, including multi-photo, is now fully device-confirmed**, not just backend/bundle-verified.
- `apps/web-dashboard`, `packages/shared`: not yet scaffolded.

**Standing constraint: consider iOS alongside Android for everything built.** Both platforms are now device-confirmed as of 2026-08-14, but this environment still has no Mac/iOS simulator — every future iOS check depends on the user testing on their own iPhone. Keep flagging platform-specific risk as new native capabilities (camera, geolocation, push) get added, since those diverge between platforms more than plain UI does.

**Hotspot topology gotcha (relevant if testing breaks again on a new network):** whichever device *hosts* the Wi-Fi hotspot cannot also run Expo Go to test against it — an iPhone providing Personal Hotspot stays on cellular itself and never joins its own Wi-Fi network, so it can't reach the dev machine's LAN IP (fails with "Internet connection appears to be offline", not a clearer network error). The fix is always: one device hosts (phone hotspot), and every device being used to test — including the laptop — joins as a Wi-Fi guest. Don't let the test device be the host.
