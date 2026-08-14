# backend

API server for the Warehouse HQ platform.

- **Framework:** NestJS + TypeScript.
- **Database:** in-memory for now (see Status) — real target is PostgreSQL (transactional records: shifts, receptions, tasks, audit logs), plus Redis for cache + pub/sub (real-time task/notification fan-out over Socket.IO), once persistence-across-restarts actually matters.
- **Auth:** JWT-based (`@nestjs/jwt` + `passport-jwt`), role-based via `RolesGuard` + `@Roles(...)` (Staff / Admin / Management — IT/Infra is a deployment concern, not an app-facing role).
- **Exposes:** REST for now. WebSocket channel for real-time task assignment/notifications comes with the features that need it (Put-Away).

## Domain models (from requirements doc)

Users, Roles, Devices, Shifts, Breaks, Receptions, SellerStockPallets, PutAwayTasks, PickPackTasks, AuditLogs. `User`, `Shift`, and `Reception` exist so far — the rest arrive with their corresponding features.

## Running it

```
npm run start:dev --workspace=packages/backend
```
Listens on `http://localhost:3000` (override with `PORT` env var; copy `.env.example` to `.env` to customize). CORS is wide open — this is a dev server, not a deployment.

**If testing from a phone on the same network:** Windows may block the connection by default on a Public-profile network (common for phone hotspots). If so, run as Administrator:
```powershell
New-NetFirewallRule -DisplayName "Warehouse HQ backend (dev, TCP 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Any
```

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

## Status

**In-memory storage — not a real database yet, on purpose.** `UsersService`, `ShiftsService`, and `ReceptionsService` hold plain arrays that reset on every restart. Deliberate scope decision (see `docs/architecture.md`): prove each vertical slice end-to-end first. Swapping to TypeORM + Postgres is a contained change per service — worth doing once the mobile app actually depends on data surviving a server restart.

**Reception (Feature 2) scope cuts, documented in `reception.types.ts`/`receptions.service.ts`, not silently dropped:**
- Sellers Stock category only collects pallet count — the doc's full weight/condition/damage branching is Feature 3, a separate future slice.
- Equipment/Other's required "photo of what received" isn't implemented — no camera/upload handling yet.
- The 2-hour review-flag (doc Step 5, itself marked "Optional") is computed and stored (`flaggedForReview`) but has no dedicated review-queue endpoint yet.

Verified end-to-end: `npm run test:e2e --workspace=packages/backend` — 8/8 passing (4 attendance, 4 reception) — plus manual curl exercise of both flows, not just type-checked.

Not yet done: Admin-driven user account creation (each real person should have their own login, not share the 3 seed accounts — deferred by explicit choice, not forgotten); WebSocket-based real-time push (currently the mobile app polls via TanStack Query refetch, not a live push).
