# Warehouse HQ

A mobile app (Android + iOS) built for a secondhand car parts marketplace's warehouse manager: staff attendance, task assignment, scheduling, and process control — with more features planned over time.

## Structure

This is an npm-workspaces monorepo:

- [apps/mobile/](apps/mobile/) — Staff & Admin native app (React Native / Expo, TypeScript).
- [apps/web-dashboard/](apps/web-dashboard/) — Management reporting & analytics (React, TypeScript).
- [packages/backend/](packages/backend/) — API server (NestJS, TypeScript).
- [packages/shared/](packages/shared/) — Cross-app TypeScript types and API client.
- [infra/](infra/) — Infrastructure as code (not yet populated).
- [docs/](docs/) — Requirements source doc, architecture decisions, and the retired PWA prototype.

See [docs/architecture.md](docs/architecture.md) for the full stack decision, rationale, and domain model.

## Status

Structure only — no app code has been scaffolded yet. Each package folder has a `package.json` and `README.md` describing what belongs there.
