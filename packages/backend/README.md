# backend

API server for the Warehouse HQ platform.

- **Framework:** NestJS + TypeScript.
- **Database:** in-memory for now (see Status) — real target is PostgreSQL (transactional records: shifts, receptions, tasks, audit logs), plus Redis for cache + pub/sub (real-time task/notification fan-out over Socket.IO), once persistence-across-restarts actually matters.
- **Auth:** JWT-based (`@nestjs/jwt` + `passport-jwt`), role-based via `RolesGuard` + `@Roles(...)` (Staff / Admin / Management — IT/Infra is a deployment concern, not an app-facing role).
- **File uploads:** local disk (`packages/backend/uploads/`, gitignored, served at `/uploads/*`) — not production-grade, see Status.
- **Exposes:** REST for now. WebSocket channel for real-time task assignment/notifications comes with the features that need it (Put-Away).

## Domain models (from requirements doc)

Users, Roles, Devices, Shifts, Breaks, Receptions, SellerStockPallets, PutAwayTasks, PickPackTasks, AuditLogs. `User`, `Shift`, `Reception`, `SellerStockPallet`, and `PutAwayTask` exist so far — the rest arrive with their corresponding features.

## Running it

```
npm run start:dev --workspace=packages/backend
```
Listens on `http://localhost:3000` (override with `PORT` env var; copy `.env.example` to `.env` to customize). CORS is wide open — this is a dev server, not a deployment.

**If testing from a phone on the same network:** Windows may block the connection by default on a Public-profile network (common for phone hotspots). If so, run as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Warehouse HQ backend (dev, TCP 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
```
**If testing on an iPhone specifically:** the iPhone cannot be the one hosting the Wi-Fi hotspot — a phone hosting Personal Hotspot stays on cellular itself and can't reach this machine. Have some other device host the hotspot, and join both the laptop and the test phone to it as guests.

**Dev login accounts** (seeded in-memory, see `src/users/users.service.ts`), all with password `password123`:
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
| GET | `/users?role=` | Bearer token, **admin/management only** | read-only, powers the "assign to staff" picker — no create/remove yet, see Status |
| POST | `/put-away-tasks` | Bearer token, **admin only** | `{ palletId, assignedToUserId, location }` — 400 if assignee isn't a staff user, 409 if the pallet already has an active task; moves the pallet to `instructed` as a side effect |
| GET | `/put-away-tasks` | Bearer token | staff see only their own tasks; admin/management see all |
| GET | `/put-away-tasks/:id` | Bearer token | 403 for staff who aren't the assignee |
| POST | `/put-away-tasks/:id/start` | Bearer token, assignee only | 409 if not in `assigned` status |
| POST | `/put-away-tasks/:id/complete` | Bearer token, assignee only | 409 if not `in_progress`; puts the pallet away as a side effect, computes `durationMs` |
| POST | `/put-away-tasks/:id/report-issue` | Bearer token, assignee only | `{ description }` — allowed from `assigned` or `in_progress` |
| POST | `/put-away-tasks/:id/reassign` | Bearer token, **admin only** | `{ assignedToUserId, location? }` — only from `issue_reported`, resets the task back to `assigned` |

## Status

**In-memory storage — not a real database yet, on purpose.** `UsersService`, `ShiftsService`, `ReceptionsService`, and `SellerStockService` hold plain arrays that reset on every restart. Deliberate scope decision (see `docs/architecture.md`): prove each vertical slice end-to-end first. Swapping to TypeORM + Postgres is a contained change per service — worth doing once the mobile app actually depends on data surviving a server restart.

**File uploads are local-disk, not production-grade either** — `uploads/` won't survive a redeploy and only works for a single server instance. Swap for S3/Cloud Storage + signed URLs when this needs to survive anything beyond local dev. Uploaded files are gitignored; the e2e test suite creates real files on disk each run (harmless, just clutter — safe to `rm -rf uploads/` any time).

**Reception (Feature 2) scope cuts, documented in `reception.types.ts`/`receptions.service.ts`, not silently dropped:**
- Sellers Stock category only collects pallet count — the doc's full weight/condition/damage branching is Feature 3 (now built — see `seller-stock/`).
- Equipment/Other's required "photo of what received" isn't implemented — no camera/upload handling for Reception specifically, even though uploads now exist (added for Seller Stock).
- The 2-hour review-flag (doc Step 5, itself marked "Optional") is computed and stored (`flaggedForReview`) but has no dedicated review-queue endpoint yet.

**Seller Stock (Feature 3) scope cuts, documented in `seller-stock.types.ts`/`seller-stock.service.ts`:**
- Doc's "batch completion" (grouping multiple pallets into one documentation-complete action) isn't modeled — each pallet is its own record.

**Multi-photo refinement (2026-08-21):** user tested Seller Stock on-device and asked to allow more than one photo for the label (previously single-photo-only) — `labelPhotoUrl: string` became `labelPhotoUrls: string[]`, with `MAX_PHOTOS_PER_FIELD` (6) enforced server-side for both label and damage-evidence photos, not just capped in the UI.

**Put-Away (Feature 4) built (2026-08-22):** proper per-staff task assignment, superseding the old direct `/seller-stock/:id/instructions` and `/seller-stock/:id/put-away` endpoints (removed — `SellerStockService`'s `giveInstructions`/`putAway`/`updateLocation` methods are still there, just called internally by `PutAwayService` now instead of exposed directly). Admin assigns a *specific* pallet to a *specific* staff member (validated: must actually be a `staff`-role user) with a location; staff starts the task (timestamp), then either completes it (timestamp, computes `durationMs`, puts the pallet away) or reports a blocking issue, which only Admin can resolve via reassignment. One active task per pallet at a time. `GET /users?role=` is new too — read-only, just enough to power the assignment picker; it is **not** the deferred user-management feature (no create/remove yet).

Verified end-to-end: `npm run test:e2e --workspace=packages/backend` — 23/23 passing (4 attendance, 4 reception, 6 seller-stock intake, 9 put-away) — not just type-checked.

Not yet done: Admin-driven user account creation (each real person should have their own login, not share the 3 seed accounts — deferred by explicit choice, not forgotten); WebSocket-based real-time push (currently the mobile app polls via TanStack Query refetch, not a live push); Performance Analytics dashboard (doc Feature 4 requirement — task durations are recorded per-task but there's no aggregated throughput view yet).
