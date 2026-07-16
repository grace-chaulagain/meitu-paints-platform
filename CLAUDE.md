# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meitu Paints Nepal: a public marketing/e-commerce site plus role-based operational dashboards (Admin, Dealer, Dispatcher, Factory), backed by a single Express/MongoDB API. It's a monorepo with two independently-installed npm packages:

- `Server/` — Express 5 + Mongoose API (ESM, Node >=20.19 <25)
- `Frontend/meitupaints/` — React 19 + Vite + Redux Toolkit (RTK Query) SPA

The root `package.json` only orchestrates Hostinger deployment/build; there is no root install step for development.

## Commands

Run these from within `Server/` or `Frontend/meitupaints/` respectively — there are no dev-time root scripts.

**Backend (`Server/`)**
```bash
npm run dev              # nodemon src/server.js (uses Server/.env)
npm run check            # node --check on server.js/app.js (syntax check only — no test suite exists)
npm run seed:admin       # seed an admin user
npm run seed:factory     # seed a factory user
npm run seed:products    # seed products
npm run seed:families    # seed product families
npm run dev:staging      # same as dev, but loads Server/.env.staging via DOTENV_CONFIG_PATH
```
There is no automated test suite (`Server/tests/unit` and `Server/tests/integration` exist but are empty; `npm test` is a stub that exits 1). `npm run check` (syntax + frontend build) is the closest thing to CI for this repo.

**Frontend (`Frontend/meitupaints/`)**
```bash
npm run dev       # vite dev server (expects API at http://localhost:5002 unless VITE_API_BASE_URL is set)
npm run build     # vite build -> dist/
npm run lint      # eslint .
```

**Full production build** (see `DEPLOYMENT.md` / `HOSTINGER_DEPLOYMENT.md` for details): build the Vite app, then run the Express server with `SERVE_CLIENT=true` so one origin serves both API and static SPA (simplifies cookies/CORS).

## Backend Architecture

Layering is strict and consistent across every feature: `routes -> controllers -> services -> models`. Controllers stay thin (validate via middleware, call one service method, format the response with `utils/apiResponse.js` / `utils/apiError.js`); business logic and DB writes live in `services/`.

- `src/app.js` wires helmet/CSP, morgan, CORS, body parsers, mounts `routes/index.js` under `/api`, and (in production with `SERVE_CLIENT=true`) serves `Frontend/meitupaints/dist` with an SPA fallback for non-API GET requests.
- `src/config/env.js` is the single source of truth for env vars — it normalizes `NODE_ENV`, enforces required vars in production (`MONGO_URI`/`MONGODB_URI`, JWT secrets, `APP_URL`), and refuses local URLs as `APP_URL` in production. Read this file before changing anything env-related.
- Auth: JWT access + refresh tokens (`utils/tokens.js`), access token sent as `Authorization: Bearer`, refresh token in an httpOnly cookie. `middlewares/auth.middleware.js` re-fetches the user on every request (checks `isActive`/`accountStatus`) rather than trusting the JWT payload alone. Roles are `ADMIN`, `DEALER`, `DISPATCHER`, `FACTORY` (`constants/roles.js`); route-level gating uses `requireRole`/`requireRoles` plus a per-resource ownership check inside the controller/service where relevant (e.g. a dealer only touching their own orders).
- `ORDER_STATUS` (defined in `models/Order.model.js`, re-exported from `constants/statuses.js` for existing import sites) is deliberately just 6 values: `SUBMITTED -> VERIFIED -> DISPATCHED -> COMPLETED`, plus the off-ramps `REJECTED`/`CANCELLED`. There is no separate "preparing"/"awaiting shipment"/"out for delivery" checkpoint and no `factoryStage` field — an order's `status` alone determines its factory-dashboard kanban column (VERIFIED = Inbox, DISPATCHED = Shipment, COMPLETED = Completed). "Closed" (admin financial reconciliation) is a `closedAt`/`closedBy` flag on top of `status`, not a status value. `PAYMENT_STATUS`/`SHIPMENT_STATUS`/`DEALER_APPLICATION_STATUS` are separate, unrelated enums (also in `constants/statuses.js`) — don't conflate their `DISPATCHED`/`DELIVERED` members with `ORDER_STATUS`'s. When touching order flow, check `order.service.js`, `factory.service.js`, `dispatcher.service.js`, `stock.service.js`, and `dispatcherStock.service.js` together since stock is reserved/decremented as orders move through these stages, and `DISPATCHED` means two different real-world things depending on `dealerSnapshot.fulfillmentMode` (factory orders: still in transit, not yet received; dispatcher-fulfilled orders: terminal, no separate delivery confirmation) — code that filters by status alone (not scoped by fulfillment mode) can silently conflate the two.
- Uploads go through `middlewares/upload.js` (multer) to Cloudinary (`utils/cloudinary.js`); PDFs (invoices/proformas) are generated in `orderPdf.service.js`.
- `googleSheetsArchive.service.js` and `src/scripts/backfill-google-sheets-archive.js` mirror order data out to Google Sheets for external reporting — treat this as a side effect to preserve, not dead code.
- Multiple `.env*` files exist per environment (`Server/.env`, `.env.staging`, `.env.hostinger.production`, plus `.example` templates) — never assume `.env` alone; check which `DOTENV_CONFIG_PATH` a given npm script uses.

## Frontend Architecture

- Routing is centralized in one large route table in `src/main.jsx` using `react-router-dom` v7 (`createBrowserRouter`). Role-gated routes wrap elements in `Require<Role>` guards defined in the same file, which read `useAuth()` and redirect to `/login?returnTo=...` or render a "session expired" prompt while `recoveringSession` is true — always check that flag before assuming `user` is null means logged-out.
- Auth session state lives in `src/auth/AuthProvider.jsx`; the low-level HTTP/token plumbing (access-token refresh-before-expiry, single in-flight refresh promise, terminal-vs-refreshable 401 classification) lives in `src/api/client.js` (a raw axios instance, not RTK Query). Refresh happens proactively (checks JWT `exp` client-side) and reactively (401 interceptor retries once).
- Server-state data (products, orders, dealers, stock, colors, etc.) is fetched via RTK Query in `src/redux/api/` — `meituApi.js` is the single large API slice (endpoints, tags, cache invalidation) built on `baseQuery.js`. Prefer adding new endpoints to this slice over hand-rolled axios+useEffect fetching. `src/redux/store.js` also holds a couple of plain slices (`userSlice`, `imageCacheSlice`, `colorsCacheSlice`) for client-only state/caching that isn't server data.
- Feature areas are organized by role/domain directory: `src/admin/` (catalog + dashboard, itself split into sub-areas like `dealers/`, `dispatchers/`, `orders/`, `insights/`, `settings/`), `src/dealer/`, `src/dispatcher/dashboard/`, `src/factory/`. Each dashboard area has its own nested routes/pages rather than sharing one generic CRUD scaffold.
- `src/ProductsList/*.json` are static product/catalog data (categories, colors, rate-calculator systems) consumed by the public product pages in `src/productsPages/` — these are content files, not generated output.
- Product/paint imagery lives under `public/` in category folders (`Primer/`, `Specialty/`, `Granite Textures/`, etc.) referenced directly by path; there's no image CDN indirection beyond Cloudinary for user-uploaded content.

## UI Design System

`Frontend/meitupaints/DESIGN.md` is the authoritative design spec for this repo (an in-progress Apple-style redesign — see the `feature/apple-design-refresh` branch). Read it before making any visual/UI change. Key points to internalize:

- Public marketing pages: premium, minimal, Apple-product-page energy — large confident type, soft fog (`#f5f5f7`) canvas, white card surfaces, restrained Apple-blue (`#0071e3`) CTAs, no heavy shadows, sparing use of Meitu red.
- Operational dashboards (Admin/Dealer/Dispatcher/Factory): compact, workflow-first, non-verbose — not styled like the marketing pages, no bloated metric walls or big charts.
- Shared design primitives: `src/index.css` (tokens), `src/components/NavBar.jsx`, `src/components/ui/ApplePageIcons.jsx` (icon set), `src/redux/imageCacheSlice.js` / `colorsCacheSlice.js` (perceived-instant image/color caching).
- Sticky side-panel pattern (product image, color room preview, rate-calculator estimate) is used repeatedly — DESIGN.md has the specific CSS caveat about not putting `overflow: hidden` on sticky parents.

## Notes

- No automated tests exist yet; verify backend changes with `npm run check` (syntax) plus manual exercising of the affected route, and verify frontend changes by running `npm run dev` and clicking through the flow (see DESIGN.md for what each page/flow is supposed to look like).
- The current branch (`feature/apple-design-refresh`) is mid-flight on a large UI redesign touching most dashboard pages — expect many files to already be modified; check `git status`/`git diff` before assuming a file is unmodified upstream code.
