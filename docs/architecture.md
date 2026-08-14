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

## Domain model (from requirements doc)

`User`, `Role` (Staff/Admin/Management/IT), `Device`, `Shift`, `Break`, `Reception` (categories: Return Parcels, Packaging Stock, Sellers Stock, Equipment/Other), `SellerStockPallet` (weight, condition, damage evidence), `PutAwayTask`, `PickPackTask`, `AuditLog`.

## Open / unresolved in the source spec

These sections in the requirements doc are stubs (headers only, no detail) and will need clarification before the corresponding domain models/screens can be designed:
- Returns and Errors Documentation
- Outgoing flow / return process ("Onglet 7")
- Reporting and visualisation ("Onglet 9")

## Next steps (not started)

1. Scaffold `apps/mobile` with Expo + TypeScript template.
2. Scaffold `packages/backend` with Nest CLI.
3. Define `packages/shared` type definitions from the domain model above.
4. Build the Attendance feature end-to-end first (smallest, most fully-specified feature) as the vertical slice proving the stack.
