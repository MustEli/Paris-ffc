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
apps/mobile/src/
├── app/                    # entry point, role-based navigation root
├── navigation/             # React Navigation stacks (Staff / Admin / Management)
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
│   ├── auth/                # login, token storage, role handling
│   ├── notifications/       # push + audible alert wiring
│   ├── offline/              # sync queue for poor warehouse connectivity
│   ├── i18n/                 # French/English strings
│   └── theme/
└── components/               # shared dumb UI (buttons, cards) used across features
```

Each `features/*` folder is self-contained — Attendance can be built, tested, and shipped without Reception existing yet. `core/` holds the cross-cutting concerns every feature needs.

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
2. **Navigation shell** — login screen + role-based routing stub (Staff / Admin / Management land on separate empty screens).
3. **Minimal backend in parallel** — just enough NestJS endpoints to support step 4 (login, start-shift, end-shift, shift-status), not the full domain model yet.
4. **Attendance feature end-to-end** (Feature 1 — smallest, most fully-specified in the doc): one real screen, one real button, one real API call, one real database row. Proves the whole stack holds together.
5. **Offline handling + push notifications**, retrofitted onto the now-working Attendance slice.
6. **Repeat the pattern** for Reception → Seller Stock → Put-Away → Order Preparation, reusing the auth/navigation/offline/notifications plumbing built in steps 2–5.
7. **EAS Build** for real device installs and MDM white-list testing, once there's something worth installing.

## Status

- `apps/mobile`: Expo + TypeScript scaffold in place (step 1 of the roadmap above). No screens/features built yet — next up is step 2 (navigation shell).
- `packages/backend`, `apps/web-dashboard`, `packages/shared`: not yet scaffolded.
