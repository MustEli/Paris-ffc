# backend

API server for the Warehouse HQ platform.

- **Framework:** NestJS + TypeScript, TypeORM.
- **Database:** PostgreSQL (transactional records: shifts, receptions, tasks, audit logs). Redis for cache + pub/sub (real-time task/notification fan-out over Socket.IO).
- **Auth:** JWT-based, role-based access control (Staff / Admin / Management / IT), device metadata check for MDM compliance at login.
- **Exposes:** REST for CRUD, WebSocket channel for real-time task assignment and notifications.

## Domain models (from requirements doc)

Users, Roles, Devices, Shifts, Breaks, Receptions, SellerStockPallets, PutAwayTasks, PickPackTasks, AuditLogs.

## Status

Skeleton only. Not yet scaffolded — see [../../docs/architecture.md](../../docs/architecture.md).
