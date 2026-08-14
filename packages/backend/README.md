# backend

API server for the Warehouse HQ platform.

- **Framework:** NestJS + TypeScript.
- **Database:** in-memory for now (see Status) — real target is PostgreSQL (transactional records: shifts, receptions, tasks, audit logs), plus Redis for cache + pub/sub (real-time task/notification fan-out over Socket.IO), once persistence-across-restarts actually matters.
- **Auth:** JWT-based (`@nestjs/jwt` + `passport-jwt`), role-based (Staff / Admin / Management — IT/Infra is a deployment concern, not an app-facing role).
- **Exposes:** REST for now. WebSocket channel for real-time task assignment/notifications comes with the features that need it (Reception, Put-Away).

## Domain models (from requirements doc)

Users, Roles, Devices, Shifts, Breaks, Receptions, SellerStockPallets, PutAwayTasks, PickPackTasks, AuditLogs. Only `User` and `Shift` exist so far — the rest arrive with their corresponding features.

## Running it

```
npm run start:dev --workspace=packages/backend
```
Listens on `http://localhost:3000` (override with `PORT` env var; copy `.env.example` to `.env` to customize). CORS is wide open — this is a dev server, not a deployment.

**Dev login accounts** (seeded in-memory, see `src/users/users.service.ts`), all with password `password123`:
- `staff@warehousehq.dev`
- `admin@warehousehq.dev`
- `management@warehousehq.dev`

## Endpoints (roadmap step 3 — Attendance vertical slice)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/` | none | health check |
| POST | `/auth/login` | none | `{ email, password }` → `{ accessToken, user }` |
| POST | `/shifts/start` | Bearer token | 409 if a shift is already active |
| POST | `/shifts/end` | Bearer token | 404 if nothing is active |
| GET | `/shifts/status` | Bearer token | `{ active, shiftId, startedAt }` |

## Status

**In-memory storage — not a real database yet, on purpose.** `UsersService` and `ShiftsService` hold plain arrays that reset on every restart. This is a deliberate scope decision for roadmap step 3 (see `docs/architecture.md`): the goal here was proving the auth + shift-lifecycle vertical slice end-to-end, not standing up Postgres. Swapping to TypeORM + Postgres is a contained change (replace the two services' internals; the controllers/DTOs/guards don't need to change) — worth doing once the mobile app actually depends on data surviving a server restart.

Verified end-to-end: server boots cleanly, all routes mapped, and the full login → start → status → conflict-on-double-start → end → not-found-on-double-end flow was exercised both manually (curl) and via the Jest e2e suite (`npm run test:e2e --workspace=packages/backend`) — 4/4 passing.

Not yet done: wiring the mobile app's mock login (`apps/mobile/src/core/auth/authStore.ts`) to actually call this API, and the Attendance feature screen itself (roadmap step 4).
