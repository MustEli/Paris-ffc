# backend

API server for the Warehouse HQ platform.

- **Framework:** NestJS + TypeScript.
- **Database:** PostgreSQL via Prisma (`prisma/schema.prisma`) — real persistence, survives restarts (see Status for the 2026-08-23 migration off the original in-memory arrays). Redis for cache + pub/sub (real-time task/notification fan-out over Socket.IO) is still a future addition, not needed yet.
- **Auth:** JWT-based (`@nestjs/jwt` + `passport-jwt`), role-based via `RolesGuard` + `@Roles(...)` (Staff / Admin / Management — IT/Infra is a deployment concern, not an app-facing role).
- **File uploads:** local disk (`packages/backend/uploads/`, gitignored, served at `/uploads/*`) — not production-grade, see Status.
- **Exposes:** REST for now. WebSocket channel for real-time task assignment/notifications comes with the features that need it (Put-Away).

## Domain models (from requirements doc)

Users, Roles, Devices, Shifts, Breaks, Receptions, SellerStockPallets, PutAwayTasks, PickPackTasks, AuditLogs. `User`, `Shift`, `Reception`, `SellerStockPallet`, `PutAwayTask`, and `OrderPrepSession`/`OrderPrepTask` (the doc's `PickPackTask`, under a name that matches the doc's own "Order Preparation" feature title) exist so far — only `AuditLog` and `Device` remain unbuilt.

## Running it

**Prerequisite (one-time):** PostgreSQL running locally (`winget install PostgreSQL.PostgreSQL.17` if not installed), with a `warehouse_hq` database created. Copy `.env.example` to `.env` (and `.env.test` for e2e — see below) and adjust `DATABASE_URL` if your Postgres credentials differ from the defaults.

```
npm run prisma:migrate --workspace=packages/backend   # first time only, or after a schema change
npm run prisma:seed --workspace=packages/backend      # (re)creates the 3 dev accounts below
npm run start:dev --workspace=packages/backend
```
Listens on `http://localhost:3000` (override with `PORT` env var). CORS is wide open — this is a dev server, not a deployment.

**Data now survives restarts.** In-memory storage was retired 2026-08-23 — see Status. `npx prisma studio --workspace=packages/backend` gives a quick GUI to browse/edit the actual database rows if you ever need to inspect or reset state by hand instead of through the API.

**If testing from a phone on the same network:** Windows may block the connection by default on a Public-profile network (common for phone hotspots). If so, run as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Warehouse HQ backend (dev, TCP 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
```
**If testing on an iPhone specifically:** the iPhone cannot be the one hosting the Wi-Fi hotspot — a phone hosting Personal Hotspot stays on cellular itself and can't reach this machine. Have some other device host the hotspot, and join both the laptop and the test phone to it as guests.

**Dev login accounts** (seeded via `prisma/seed-data.ts` — run `npm run prisma:seed` to (re)create them), all with password `password123`:
- `staff@warehousehq.dev`
- `admin@warehousehq.dev`
- `management@warehousehq.dev`

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | none | health check |
| POST | `/auth/login` | none | `{ email, password }` → `{ accessToken, user }` |
| POST | `/shifts/start` | Bearer token | 409 if a shift is already active |
| POST | `/shifts/end` | Bearer token | 404 if nothing is active |
| GET | `/shifts/status` | Bearer token | `{ active, shiftId, startedAt }` |
| POST | `/receptions` | Bearer token | `{ category, ...category-specific fields }` — see `reception.types.ts` |
| GET | `/receptions` | Bearer token | full log, newest first |
| GET | `/receptions/:id` | Bearer token | single reception |
| POST | `/receptions/:id/instructions` | Bearer token, **admin only** | `{ instructions }` — 403 for non-admins, 409 if not in `arrived` status |
| POST | `/receptions/:id/complete` | Bearer token | 409 if not in `ready_for_putaway` status |
| POST | `/uploads` | Bearer token | multipart `file` field → `{ url: "/uploads/<uuid>.jpg" }` (relative path, not absolute) |
| POST | `/seller-stock` | Bearer token | `{ labelPhotoUrls[], boxNumber, sellerName, weightKg, condition, damageRemarks?, damageEvidencePhotoUrls? }` — 400 if damaged without remarks+evidence, or if either photo array exceeds `MAX_PHOTOS_PER_FIELD` (6) |
| GET | `/seller-stock` | Bearer token | full pipeline, newest first |
| GET | `/seller-stock/:id` | Bearer token | single pallet |
| GET | `/users?role=` | Bearer token, **admin/management only** | list, optionally filtered by role |
| GET | `/users/:id` | Bearer token, **admin/management only** | single user |
| POST | `/users` | Bearer token, **admin only** | `{ name, email, password, role }` — 409 if the email already exists |
| DELETE | `/users/:id` | Bearer token, **admin only** | 400 if removing yourself, or the last remaining admin |
| POST | `/users/:id/role` | Bearer token, **admin only** | `{ role }` — 400 if it's the sole admin demoting themselves |
| POST | `/put-away-tasks` | Bearer token, **admin only** | `{ palletId, assignedToUserId, location }` — 400 if assignee isn't a staff user, 409 if the pallet already has an active task; moves the pallet to `instructed` as a side effect |
| GET | `/put-away-tasks` | Bearer token | staff see only their own tasks; admin/management see all |
| GET | `/put-away-tasks/:id` | Bearer token | 403 for staff who aren't the assignee |
| POST | `/put-away-tasks/:id/start` | Bearer token, assignee only | 409 if not in `assigned` status |
| POST | `/put-away-tasks/:id/complete` | Bearer token, assignee only | 409 if not `in_progress`; puts the pallet away as a side effect, computes `durationMs` |
| POST | `/put-away-tasks/:id/report-issue` | Bearer token, assignee only | `{ description }` — allowed from `assigned` or `in_progress` |
| POST | `/put-away-tasks/:id/reassign` | Bearer token, **admin only** | `{ assignedToUserId, location? }` — only from `issue_reported`, resets the task back to `assigned` |
| POST | `/order-prep/sessions` | Bearer token, **admin only** | `{ totalParts }` → computes `pickersNeeded`/`packersNeeded`/`packingDelayMinutes` — see `order-prep.types.ts` for the formula and its assumptions |
| GET | `/order-prep/sessions` | Bearer token | all sessions, newest first |
| GET | `/order-prep/sessions/:id` | Bearer token | session + its tasks |
| POST | `/order-prep/sessions/:id/tasks` | Bearer token, **admin only** | `{ assignedToUserId, role: 'picker'\|'packer' }` — 400 if assignee isn't staff |
| GET | `/order-prep/tasks` | Bearer token | staff see only their own tasks; admin/management see all |
| GET | `/order-prep/tasks/:id` | Bearer token | 403 for staff who aren't the assignee |
| POST | `/order-prep/tasks/:id/start` | Bearer token, assignee only | pickers: always OK once assigned (first one to start sets the session's `pickingStartedAt`). Packers: 409 until `pickingStartedAt + packingDelayMinutes` has passed |
| POST | `/order-prep/tasks/:id/complete` | Bearer token, assignee only | 409 if not `in_progress`; computes `durationMs` |

## Status

**Postgres persistence built (2026-08-23) — replaces the original in-memory arrays.** Every service (`UsersService`, `ShiftsService`, `ReceptionsService`, `SellerStockService`, `PutAwayService`, `OrderPrepService`) now reads/writes through `PrismaService` (`prisma/schema.prisma`) instead of a local array that reset on restart. No DTO/controller/guard/domain-type changes — the Prisma schema mirrors each `*.types.ts` shape 1:1, so this was purely a storage swap (see `docs/architecture.md`'s dated entry for the full writeup: why no DB-level foreign keys, the two-database dev/test setup, and the e2e reset harness `test/utils/db.ts` needed once tests share one real database instead of getting a fresh in-memory store per test).

Verified for real: booted the dev server, started a shift, killed the process outright, restarted it, and confirmed `GET /shifts/status` still returned the same shift — not just passing tests. `npm run test:e2e --workspace=packages/backend` — 41/41 passing against the real `warehouse_hq_test` database. **Note:** `test:e2e` now runs with `--runInBand` (serial, not parallel) — parallel Jest workers each reset the *same* shared test database, which raced and threw unique-constraint errors. **Confirmed on-device too (2026-08-23)** — user repeated the same start-shift → restart-backend → still-active check on their own phone.

**File uploads are still local-disk, not production-grade** — `uploads/` won't survive a redeploy and only works for a single server instance. Swap for S3/Cloud Storage + signed URLs when this needs to survive anything beyond local dev. Uploaded files are gitignored; the e2e test suite creates real files on disk each run (harmless, just clutter — safe to `rm -rf uploads/` any time).

**Reception (Feature 2) scope cuts, documented in `reception.types.ts`/`receptions.service.ts`, not silently dropped:**
- Sellers Stock category only collects pallet count — the doc's full weight/condition/damage branching is Feature 3 (now built — see `seller-stock/`).
- Equipment/Other's required "photo of what received" isn't implemented — no camera/upload handling for Reception specifically, even though uploads now exist (added for Seller Stock).
- The 2-hour review-flag (doc Step 5, itself marked "Optional") is computed and stored (`flaggedForReview`) but has no dedicated review-queue endpoint yet.

**Seller Stock (Feature 3) scope cuts, documented in `seller-stock.types.ts`/`seller-stock.service.ts`:**
- Doc's "batch completion" (grouping multiple pallets into one documentation-complete action) isn't modeled — each pallet is its own record.

**Multi-photo refinement (2026-08-21):** user tested Seller Stock on-device and asked to allow more than one photo for the label (previously single-photo-only) — `labelPhotoUrl: string` became `labelPhotoUrls: string[]`, with `MAX_PHOTOS_PER_FIELD` (6) enforced server-side for both label and damage-evidence photos, not just capped in the UI.

**Put-Away (Feature 4) built (2026-08-22):** proper per-staff task assignment, superseding the old direct `/seller-stock/:id/instructions` and `/seller-stock/:id/put-away` endpoints (removed — `SellerStockService`'s `giveInstructions`/`putAway`/`updateLocation` methods are still there, just called internally by `PutAwayService` now instead of exposed directly). Admin assigns a *specific* pallet to a *specific* staff member (validated: must actually be a `staff`-role user) with a location; staff starts the task (timestamp), then either completes it (timestamp, computes `durationMs`, puts the pallet away) or reports a blocking issue, which only Admin can resolve via reassignment. One active task per pallet at a time. `GET /users?role=` is new too — read-only, just enough to power the assignment picker; it is **not** the deferred user-management feature (no create/remove yet).

Verified end-to-end: `npm run test:e2e --workspace=packages/backend` — 23/23 passing (4 attendance, 4 reception, 6 seller-stock intake, 9 put-away) — not just type-checked. Confirmed working on real devices too, after fixing two bugs found in the process: this server was serving stale code after a code-only restart (`nest start --watch` didn't pick up the brand-new `put-away`/`users` module files without a *full* process restart, not just its own file-watch reload), and the mobile `AssignTaskScreen` was silently swallowing a failed request instead of showing the resulting 404.

**In-app audible task-assignment alerts (2026-08-22, user request):** doc's "staff receives a notification with destination details" — mobile-only change (`apps/mobile/src/features/putAway/hooks/useTaskAssignmentAlerts.ts` polls this API and fires a local notification), no backend change needed since it just polls the existing `GET /put-away-tasks`. **Not real push** — deliberately scoped to what Expo Go actually supports (see `docs/architecture.md` for why real push needs a bigger step, an EAS Build migration).

**Order Preparation (Feature 5) built (2026-08-23):** the last feature in the doc's main sequence, and the only one that's a labor calculator rather than a single-item pipeline. `POST /order-prep/sessions` takes a part volume and computes staffing (`order-prep.types.ts` documents the exact formula — the doc gives throughput rates, 25 parts/hr/picker and 20/hr/packer, but no formula for staff count or stagger delay, so both are stated, tunable assumptions, not values from the doc). Task assignment reuses the same assign→start→complete pattern as Put-Away, plus one new mechanic: a packer's `start` is rejected with 409 until enough time has passed since the first picker actually started (not session creation time) — the doc's "prevent packer idle time" requirement.
- **Deliberately not built:** per-task part-count capture (doc mentions "pick xx parts" as a target, but tracking actual parts-per-task isn't needed to prove the stagger-timing mechanic) and the resulting "refine average throughput" analytics loop — same Performance Analytics deferral as Put-Away.

Verified end-to-end: `npm run test:e2e --workspace=packages/backend` — 31/31 passing (4 attendance, 4 reception, 6 seller-stock, 9 put-away, 8 order-prep) — not just type-checked. Confirmed on-device — this completes device confirmation for all five main features from the requirements doc.

**Admin user management built (2026-08-23) — the long-deferred gap, finally closed.** Admin can now create individual staff/admin/management accounts with their own credentials, change any user's role, and remove accounts — the 3 seed accounts are just initial data now, not a hard limit. Two safety guards baked into `UsersService` to prevent an admin from locking everyone out: can't remove your own account, and can't remove (or self-demote from) the last remaining admin. `GET /users`/`GET /users/:id` stayed admin+management (read-only); create/remove/role-change are admin-only.

Verified end-to-end: `npm run test:e2e --workspace=packages/backend` — 41/41 passing (4 attendance, 4 reception, 6 seller-stock, 9 put-away, 8 order-prep, 10 user management) — not just type-checked.

Not yet done: real (remote) push notifications; Performance Analytics dashboard (doc Feature 4/5 requirement — task durations are recorded per-task but there's no aggregated throughput view yet); password reset / self-service account changes (Admin can create/remove/change-role, but there's no "change your own password" flow yet).
