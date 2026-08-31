# Foundation Notes for a New WMS App Project

> **What this document is:** technical and process lessons written by Claude at
> the end of an earlier, separate project — a warehouse-management app built
> for a different company (internally called "Warehouse HQ" / "ELNO"). It is
> meant to be handed to Claude at the *start* of a new, unrelated project for
> a different company, alongside that new project's own requirements
> document.
>
> **What this document is NOT:** it says nothing about the new project's
> actual requirements — those belong in a separate requirements doc, written
> fresh for the new company. Nothing below should be read as implying
> anything about the new company's name, branding, workflow rules, or
> business specifics. This is a template/lessons doc, not a build spec.
> If anything below conflicts with what the new company's own requirements
> doc says, the requirements doc wins.

## 1. Stack that worked well

- **npm workspaces monorepo**: `apps/mobile`, `packages/backend`,
  `packages/shared` (a shared types/utilities package — worth actually
  building out this time, rather than leaving it empty as happened before).
  A fourth workspace, `apps/web-dashboard`, was also scaffolded (for a
  future management-reporting web app) but never actually built out —
  it's an empty shell, not a working pattern, so don't treat it as
  something proven. Only add a web app to the new project if it actually
  needs one.
- **Mobile**: React Native via Expo, TypeScript.
- **Backend**: NestJS + TypeScript + Prisma ORM + PostgreSQL.
- Rationale that held up: one language (TypeScript) across the whole stack
  keeps things simple when the spec is expected to keep growing. Re-evaluate
  only if the new project's constraints (e.g. an existing server stack,
  existing team conventions) push a different choice — don't default to this
  stack without checking it still fits.

## 2. Environment gotchas worth pre-empting (mostly Windows-specific)

- **`nest build` / `nest start` are unreliable on Windows** — they can
  silently produce zero build output while reporting success. Fix: add a
  `dev` npm script that bypasses Nest's wrapper entirely:
  `"dev": "tsc -p tsconfig.build.json && node dist/main"`. Use this for all
  local dev instead of `start`/`start:dev`.
- **`tsconfig.build.json` needs an explicit `rootDir`** (scoped to `./src`)
  and must exclude any sibling non-source folder (e.g. a `prisma/` directory
  with seed scripts) — otherwise TypeScript infers `rootDir` as their common
  parent and nests compiled output one level too deep (`dist/src/main.js`
  instead of `dist/main.js`). This kind of bug won't surface via `nest
  start` (a different execution path) — only by actually running
  `node dist/main.js` directly, which is what a real deploy's start command
  does. Verify the literal start command locally before trusting it.
- **`$env:Path` doesn't persist across separate shell invocations** in an
  agent harness — if `node`/`npm` come back "not recognized," re-read
  the registry PATH in the same command rather than assuming installation
  failed.
- **Prisma's postinstall may get blocked by npm's script-approval gate** —
  needs `npm approve-scripts` + `npm rebuild` once.
- **Prisma CLI ignores `NODE_ENV`** for choosing which `.env` file to load —
  use `dotenv-cli` (`npx dotenv -e .env.test -- <command>`) to target a
  specific environment explicitly for CLI commands (migrate, seed, etc.).
- **Orphaned Node processes can hold a port after Ctrl+C on Windows** —
  before assuming a restart picked up new code, verify: check what's
  actually listening (`Get-NetTCPConnection -LocalPort <port>`) and kill it
  by PID if it predates the restart, rather than trusting that Ctrl+C worked.

## 3. Mobile / EAS lessons

- **Give every EAS build profile (development/preview/production) its own
  Android package name / iOS bundle ID** if more than one will ever be
  installed on the same device — otherwise installing one **silently
  uninstalls** another sharing the same identity, with no error. Do this via
  a dynamic `app.config.js` keyed on `process.env.EAS_BUILD_PROFILE` (set by
  EAS during a real cloud build, absent locally).
- **A standalone build (preview/production profile) bundles its JS at build
  time and does not talk to a live Metro server** — any JS-only change
  requires a fresh EAS build to reach an already-installed standalone app.
  Only the `development` profile behaves like Expo Go (instant reload on
  save). Don't expect a code change to "just show up" on a standalone build.
- **Diagnosing a "nothing changed" report**: don't guess at caching — verify
  directly. Fetch the actual bundle being served (`curl` the Metro bundle
  URL) and grep it for both a new-code marker string and an old-code marker
  string. If the served bundle is provably current but the device still
  shows old behavior, the device is likely running a different
  build/install entirely (see the package-identity-collision gotcha above),
  not a caching issue.

## 4. Backend/data lessons

- **Prisma's `String @id @default(uuid())` creates a `TEXT` column, not
  Postgres's native `UUID` type** — that only happens if you add
  `@db.Uuid` explicitly. Decide deliberately this time whether that matters
  (at small-to-medium scale it doesn't, but it's worth being an intentional
  choice rather than an unexamined default).
- **Password hashing (bcrypt or similar) produces a different hash for the
  same password across different users — this is correct, deliberate
  salting, not a bug.** It defeats rainbow-table attacks and stops anyone
  who gets the database from spotting which users share a password.
- **A free-hosting combo that worked for a pre-revenue pilot**: Render
  (backend — sleeps after ~15 min idle, several-second-to-a-minute cold
  start on the next request) + Neon (Postgres — doesn't auto-delete the way
  some platforms' bundled free databases do) + Cloudinary (file storage,
  since many free app-hosting tiers have no persistent disk). Only relevant
  if the new project also needs free-tier hosting — if the new company
  provides their own server, get real specifics (OS, network reachability,
  existing database, deploy access) before assuming any of this applies.

## 5. Reusable architectural *patterns* (the shape, not the literal code)

- **Assign → start → complete (or report an issue → reassign), with
  duration computed automatically** — a task-assignment pattern used
  successfully more than once in the earlier project. Likely a strong
  starting template for any "assign work to a specific person, track how
  long it took" feature, including pick/pack workflows — but rebuild it
  against the new domain's actual rules rather than copying the old
  feature's specific business logic.
- **Role-based access**: a `@Roles(...)` decorator plus a guard that checks
  the authenticated user's role, applied per-endpoint.
- **A shared hub/menu screen component** for each role's landing screen,
  and **a shared keyboard-aware scroll wrapper** applied to every screen
  with a text input (handles the keyboard covering content, and
  tap-anywhere-to-dismiss) — both are generic UI infrastructure worth
  reusing directly.

## 6. Process lessons (how the work went, worth repeating)

- **Before implementing a nontrivial UI/UX change, restate the plan in
  plain text first and confirm understanding before touching code.** This
  caught at least one real design mistake before it shipped, and avoided
  wasted cycles more than once.
- **Verify claims for real, not just via type-checking.** Actually run the
  compiled artifact, hit the real deployed URL, or fetch the actual served
  bundle — "it type-checks" and "the tests pass" are not the same claim as
  "this is what's really running."
- **When asked to hide/restrict something for a specific audience, look for
  a zero-code option first** (e.g. simply not issuing a set of credentials)
  before reaching for a code change — often cheaper and just as effective.

---

## Files worth copying from the old repo into the new project

**Copy close to as-is (generic infrastructure, not tied to the old
company's business):**
- `apps/mobile/src/core/components/KeyboardAwareScreen.tsx`
- `apps/mobile/src/navigation/screens/MenuScreen.tsx` (generic
  hub-screen pattern)
- `packages/backend/src/auth/**` (JWT login, guards, roles decorator)
- `packages/backend/src/users/**` — the account CRUD / role-management
  shape (drop the trial-gating fields/logic unless the new project also
  starts as a capped pilot)
- `packages/backend/src/prisma/**` (PrismaService wiring)
- `packages/backend/tsconfig.build.json` (the `rootDir`/`exclude` fix) and
  the `dev` npm script pattern from `package.json`
- `apps/mobile/eas.json` and the dynamic `app.config.js` pattern
  (profile-based app identity)
- `render.yaml`'s general shape, *if* the new project also deploys to
  Render — otherwise just as a reference for "build command runs
  migrations + seed, start command runs the compiled entrypoint directly."

**Worth reading as a reference template, but rewriting fresh for the new
domain — don't copy verbatim:**
- `packages/backend/src/put-away/**` and `packages/backend/src/order-prep/**`
  — the assign/start/complete/duration pattern described in section 5.

**Don't copy:**
- `docs/requirements/**`, any branding assets, seed data content, `.env`
  files/secrets, and the fully domain-specific feature modules (reception,
  seller-stock) — none of it applies to a different company's process.
