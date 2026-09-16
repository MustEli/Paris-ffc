# web-dashboard

Admin back-office web app — Admin-only, separate from (and not a clone of) the mobile app's Admin experience.

- **Framework:** React + TypeScript + Vite, React Router, TanStack Query.
- **Consumes:** the same backend API the mobile app uses — no backend was forked or duplicated for this.

## What it covers

- **Dashboard** — the same live/today/per-staff status the mobile Admin dashboard shows (`GET /reports/admin-dashboard`). The one screen here that's a deliberate rough mirror of mobile.
- **Manage Lists** — admin-managed values (e.g. Reception's Transporter Company / Packaging Type) that populate dropdowns on the mobile app, instead of staff typing free text. One generic screen covers every category — see `packages/backend/src/reference-lists/`.
- **Reception Instructions** — give instructions one at a time, or download an Excel template pre-filled with every reception awaiting instructions, fill in the Instructions column, and re-upload for a bulk apply (with a preview before anything is submitted).
- **Seller Stock Photos** — select one or more pallets and download all their photos as a single zip file, built client-side from Cloudinary's public URLs (no new backend endpoint needed for this).

## Running it locally

```
npm run dev --workspace=apps/web-dashboard
```

Defaults to talking to `http://localhost:3000` (a locally-running backend — see `packages/backend/README.md`). To point it at a different backend, copy `.env.example` to `.env` and set `VITE_API_BASE_URL`.

## Auth

Unlike the mobile app (token held in-memory only, by design), this persists the login token to `localStorage` — a browser tab commonly gets refreshed or reopened through a workday, and re-typing a password every time would be real friction for a desk tool. Login is restricted to Admin accounts; every feature here is Admin-gated on the backend too.

## Deploying

Not yet deployed. Plan: a Render Static Site (same account as the backend), pointed at this repo, with:
- **Build command:** `npm install && npm run build --workspace=apps/web-dashboard`
- **Publish directory:** `apps/web-dashboard/dist`
- **Environment variable:** `VITE_API_BASE_URL` set to the live backend URL.

Set up through Render's dashboard directly (same as the backend originally was), not a `render.yaml` blueprint entry — Render's static-site blueprint schema wasn't worth guessing at when the dashboard path is simple and already proven for this project.
