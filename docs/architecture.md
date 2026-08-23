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
- **Backend API**: NestJS + TypeScript + Prisma (originally speculated as TypeORM in this doc's first draft — see Status for why Prisma was picked once a real schema/services existed: schema-first single source of truth + a fully-typed client, less boilerplate than TypeORM's decorator-entity classes for a domain this size).
- **Database**: PostgreSQL (transactional: shifts, receptions, tasks, audit logs) — **live since 2026-08-23**, see Status.
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
6. **Repeat the pattern** for Reception → Seller Stock → Put-Away → Order Preparation, reusing the auth/navigation/offline/notifications plumbing built in steps 2–5. *(All four done — see Status below. This completes the doc's main feature sequence; Returns/Errors, Onglet 7, and Reporting remain unbuilt because the doc itself never specified them beyond stub headers.)*
7. **EAS Build** for real device installs and MDM white-list testing, once there's something worth installing.

## Status

- `apps/mobile`: Expo + TypeScript scaffold, pinned to SDK 54 (steps 1–2 of the roadmap above). Confirmed working end-to-end on both a real Android device and a real iPhone via Expo Go.
- Navigation shell in place, confirmed on a real Android device: `RootNavigator` switches between `AuthNavigator` and a `StaffNavigator` / `AdminNavigator` / `ManagementNavigator`, each showing a placeholder home screen (Staff's is now the real Attendance screen — see below) and a logout button.
- `packages/backend`: NestJS scaffold with real `auth` and `shifts` modules — JWT login, and a working start/end/status shift lifecycle with correct conflict handling (409 on double-start, 404 on double-end). **Postgres-backed since 2026-08-23** — see below and `packages/backend/README.md` Status. Verified via a passing Jest e2e suite plus manual curl exercise of the full flow, not just type-checked.
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
- **Put-Away feature (roadmap step 6, Feature 4) built:** the proper per-staff task-assignment layer the doc describes, superseding the simpler direct instructions/put-away endpoints that used to live on `seller-stock` — Admin now assigns a *specific* pallet to a *specific* staff member (validated to actually be staff) with a location; staff starts the task, then either completes it (duration computed, pallet put away as a side effect) or reports a blocking issue, which only Admin can resolve via reassignment. New `packages/backend/src/put-away/` module and a read-only `GET /users?role=` endpoint (just enough to power the assignment picker — **not** the still-deferred user-management feature). Mobile gained `features/putAway/` (AssignTaskScreen, PutAwayTaskListScreen, PutAwayTaskDetailScreen), and `SellerStockDetailScreen` was trimmed down to read-only pallet info + a link into assignment, since that screen no longer owns the instructions/put-away interaction directly.
  - **Deliberately not built yet** (doc requirement, explicitly deferred): a dedicated Performance Analytics dashboard aggregating task durations — the data (`durationMs` per task) is recorded, just no aggregated view.
  - Verified: backend e2e 23/23 passing (4 attendance, 4 reception, 6 seller-stock, 9 put-away), `tsc` clean (both packages), real android+ios bundles build. Confirmed working on-device (2026-08-22), including finding and fixing two real bugs along the way: the backend was serving stale code (needed a real restart, not just `--watch`'s auto-reload, to pick up brand-new module files) and `AssignTaskScreen` swallowed query errors completely silently instead of showing them.
- **In-app audible task-assignment alerts built (2026-08-22, user request):** the doc's "staff receives a notification with destination details" requirement, scoped to what's actually achievable in Expo Go today. **Not real push** — Expo Go on Android hasn't supported remote push since SDK 53 at all (needs a development build + FCM credentials); real push for both platforms would mean migrating off Expo Go to EAS Build, a materially bigger step (Expo account, real builds, no more scan-and-go testing). Instead: `useTaskAssignmentAlerts` polls `GET /put-away-tasks` every 15s for the whole staff session (mounted in `StaffNavigator`, not tied to any one screen) and fires a **local** notification with sound via `expo-notifications` the moment a new `assigned` task appears. Works in Expo Go on both platforms right now, with the honest limitation that it only fires while the app is open or recently backgrounded, not fully closed.
  - **Confirmed on-device, then fixed a real bug the user's own test uncovered:** the "new" detection was keyed off task IDs seen since the hook last mounted, which broke across the only realistic single-device test workflow (staff logs out → admin assigns → staff logs back in — logging out unmounts the hook, wiping its memory). Fixed by keying off the task's `assignedAt` timestamp (recent = within 2 minutes) instead, which survives logout/login and app restarts. General lesson: mount-lifecycle-scoped "have I seen this" state is fragile for anything a user might test across a logout/login cycle.
- **Order Preparation feature (roadmap step 6, Feature 5) built — completes the doc's main feature sequence:** the only feature that's a labor calculator rather than a single-item pipeline. Admin inputs a total part volume; `packages/backend/src/order-prep/order-prep.types.ts` computes pickers/packers needed and a packing-start stagger delay from documented, tunable assumptions (the doc gives throughput rates — 25 parts/hr/picker, 20/hr/packer — but no formula for staff count or delay). Task assignment reuses the Put-Away assign→start→complete pattern, plus one new mechanic: a packer's start is rejected until enough time has passed since the first picker *actually* started (not session-creation time) — the doc's "prevent packer idle time" requirement. `useStaffUsers` (the assign-to-staff picker hook) moved from `features/putAway` to `core/hooks/` since it's now shared by two features.
  - **Deliberately not built:** per-task part-count capture and the "refine average throughput" analytics loop — same Performance Analytics deferral as Put-Away.
  - Verified: backend e2e 31/31 passing (4 attendance, 4 reception, 6 seller-stock, 9 put-away, 8 order-prep), `tsc` clean (both packages), real android+ios bundles build.
  - **Confirmed on-device (2026-08-23).** This completes device confirmation for all five main features from the requirements doc — Attendance, Reception, Seller Stock, Put-Away, and Order Prep are all built, backend-tested, and proven working on a real phone.
  - Getting here needed the same stale-backend-process fix a third time — see the standing note below, now with a one-line self-service fix so this doesn't need to come back to me each time.
- **Admin user management built (2026-08-23) — the long-deferred gap finally closed.** Admin can create individual staff/admin/management accounts with their own credentials (`features/userManagement/`: UserListScreen, NewUserScreen, UserDetailScreen), change any user's role, and remove accounts — the 3 seed accounts are now just initial data, not a hard limit. Two safety guards in `UsersService` prevent self-lockout: can't remove your own account, and can't remove or self-demote from the last remaining admin. Verified: backend e2e 41/41 passing, `tsc` clean (both packages), real android+ios bundles build. **Confirmed on-device (2026-08-23).**
- **Postgres persistence built (2026-08-23) — closes the biggest gap between "features work in a demo" and "practical for real warehouse use."** Every backend service (`UsersService`, `ShiftsService`, `ReceptionsService`, `SellerStockService`, `PutAwayService`, `OrderPrepService`) previously held a plain in-memory array that reset on every server restart — a deliberate early scope cut, but one that meant the app couldn't actually be trusted with real data. Installed PostgreSQL 17 locally (`winget install PostgreSQL.PostgreSQL.17`), added Prisma (`packages/backend/prisma/schema.prisma` mirrors the existing `*.types.ts` domain shapes 1:1 — no design changes, just a storage swap), and rewrote every service to query through a `PrismaService` instead of a local array. DTOs, controllers, and guards were untouched except for `await`ing calls that are now async (Prisma is promise-based; the in-memory version was synchronous).
  - **Deliberately no DB-level foreign keys** between e.g. `PutAwayTask.assignedToUserId` and `User.id` (see `schema.prisma`'s comment) — the app already validates these references at the service layer before writing, exactly like the in-memory version did. A real FK constraint would make removing a user who has any history (a completed shift, a past task) fail with a constraint violation, a behavior change nobody asked for. Real referential-integrity/audit policy (cascade? soft-delete? keep history forever?) is a deliberate future product decision, not a side effect of "add a database."
  - **Two separate databases**: `warehouse_hq` (dev) and `warehouse_hq_test` (e2e), same schema, controlled by `.env` vs `.env.test` (both gitignored; `.env.example` documents the shape). The 3 dev accounts (`prisma/seed-data.ts`) are seeded into both via `npm run prisma:seed` / the e2e reset helper — still just initial data, not a hard limit, per the user-management feature above.
  - **e2e suite needed a real reset harness, not just a fresh Nest module per test.** Every spec file used to get an empty store for free (`Test.createTestingModule` instantiated brand-new in-memory services each time); against a persistent shared Postgres DB that assumption breaks immediately — e.g. a test removing the seed admin would 401 every later test's `loginAs('admin@warehousehq.dev')`. Fixed with `test/utils/db.ts`'s `resetDatabase()` (wipes every table, reseeds the 3 dev accounts) called at the top of every `beforeEach`. **Also had to add `--runInBand`** to `test:e2e` — Jest's default parallel workers were racing each other's resets against the same physical database (`Unique constraint failed` on the seed users), invisible until tests actually hit shared state instead of isolated memory.
  - Verified for real, not just "tests pass": booted the real dev server, logged in, started a shift, **killed the entire Node process and restarted it**, and confirmed `GET /shifts/status` still returned the exact same shift ID and timestamp with no re-login — the actual thing this work was for. Backend e2e suite: 41/41 passing against the real `warehouse_hq_test` database (not mocked), `tsc` clean.
  - **Confirmed on-device (2026-08-23):** user started a shift on their phone, fully restarted the backend, and confirmed the shift was still active with no re-login — the actual thing this work was for. This closes the persistence gap end-to-end, not just at the API level.
- **Management role built (2026-08-23) — the last of the four roles named in Feature 0 to get real screens.** Since day one, Management had only a placeholder ("Reporting tools and visual analytics dashboards will live here"). Backend gained `src/reports/` — a read-only aggregation layer (no new tables) computing the reports the doc scatters across features: Feature 0's "Management dashboards aggregate this data to visualize advancement and efficiency metrics," Feature 2's "Average Processing Time report per reception category," Feature 4's "Performance Analytics... to support management review," and Feature 5's "refine the average throughput metrics." Five endpoints (`overview`, `attendance`, `reception`, `put-away`, `order-prep`), gated admin+management like `GET /users`.
  - Mobile: `features/reports/` — a `DashboardScreen` with plain-View proportional-width bars (`BarRow`) and stat cards (`StatCard`), deliberately not a charting library (avoids an Expo-Go-compatibility risk for a dependency that isn't load-bearing to the app otherwise). `ManagementHomeScreen` is now a real `MenuScreen` (was the last role still using `PlaceholderHomeScreen`, now deleted) linking to the Dashboard plus read-only reach into Reception/Seller Stock/Put-Away/Order Prep's existing list+detail screens — reused as-is, not rebuilt, since every shared detail screen already gates its action buttons by role (`role === 'admin'`/`role === 'staff'`), so Management sees the same screens with no actions rendered.
  - **Found and fixed two real gaps while wiring this up, not just added code:** `OrderPrepSessionListScreen`'s "+ New Session" button and `OrderPrepSessionDetailScreen`'s "Assign a task" section had no role gate at all (harmless before now, since only Admin ever reached those screens) — both would have been live but broken for Management (button visible, then 403 or a missing-route crash). Fixed by gating both behind `role === 'admin'`, matching every other shared screen's pattern.
  - **Deliberately not built:** per-staff drill-down on the dashboard (e.g. "which staff combination is fastest" — Feature 5 mentions this explicitly) and a true parts/hr throughput figure for Order Prep (blocked on the already-documented scope cut that per-task part-count isn't captured) — task duration is the closest honest proxy available from data actually being recorded.
  - Verified: backend e2e 47/47 passing (41 previous + 6 new reports tests), `tsc` clean on both packages, real android+ios bundles build. **Not yet device-tested.**
- `apps/web-dashboard`, `packages/shared`: not yet scaffolded.

**Standing gotcha: `Ctrl+C` on a `nest start --watch` terminal often doesn't actually kill the underlying Node process on Windows.** It kills the visible wrapper; the compiled server can survive as an orphan silently holding port 3000, serving stale code indefinitely. Hit three separate times across this project. Self-service fix — run before restarting the backend, from any directory:
```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
Then `cd` to the project and `npm run start:dev --workspace=packages/backend` as usual. Closing the whole terminal window (not just Ctrl+C) before reopening one also tends to work more reliably than Ctrl+C alone.

**Standing constraint: consider iOS alongside Android for everything built.** Both platforms are now device-confirmed as of 2026-08-14, but this environment still has no Mac/iOS simulator — every future iOS check depends on the user testing on their own iPhone. Keep flagging platform-specific risk as new native capabilities (camera, geolocation, push) get added, since those diverge between platforms more than plain UI does.

**Hotspot topology gotcha (relevant if testing breaks again on a new network):** whichever device *hosts* the Wi-Fi hotspot cannot also run Expo Go to test against it — an iPhone providing Personal Hotspot stays on cellular itself and never joins its own Wi-Fi network, so it can't reach the dev machine's LAN IP (fails with "Internet connection appears to be offline", not a clearer network error). The fix is always: one device hosts (phone hotspot), and every device being used to test — including the laptop — joins as a Wi-Fi guest. Don't let the test device be the host.
