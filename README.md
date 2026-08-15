# Hometown Modular Lamp

Premium storefront and geometry foundation for modular, FDM-printed lamp shades inspired by Vietnamese places.

## Current product surface

- Vite + React + TypeScript storefront with HashRouter routes for catalog, collections, product detail, custom studio, cart, checkout, order confirmation, 3D showcase, contact, story and admin views.
- React Three Fiber viewer with orbit controls, realtime color/light controls and a parametric lamp mesh.
- `@hometown/geometry` pipeline primitives: profile normalization, shape generation, mesh generation, FDM validation, STL export and GLB metadata export.
- Supabase-compatible Postgres migration with product, collection, province, hardware, order, email, design-project and settings models.
- Fastify API with server-side price calculation, rate limiting, validation, Supabase catalog/order persistence when configured, protected admin operations and SMTP email provider.
- Tauri 2 desktop shell configured for Windows NSIS and macOS DMG targets.
- GitHub Actions for validation and GitHub Pages deployment.

## Quick start

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

For order persistence and email, copy `.env.development.example` to `.env`, set the Supabase/API values, and run the API in a second terminal:

```bash
corepack pnpm dev:api
```

The API loads `.env` from either the workspace root or `services/api/.env`. The custom studio can download the current validated geometry as STL, 3MF or GLB.

The web app intentionally does not pretend that email or database persistence exists when no API is configured; checkout displays a clear configuration error instead. The authenticated `/admin` route loads live orders and status changes when `VITE_API_URL`, Supabase Auth and an `ADMIN` profile are configured.

## Routes

`/`, `/products`, `/products/:slug`, `/collections`, `/collections/:slug`, `/customize/:productId`, `/cart`, `/checkout`, `/order/:id`, `/about`, `/contact`, `/3d-showcase`, `/admin`.

## GitHub Pages

The `deploy-pages.yml` workflow publishes `apps/web/dist` on every push to `main`. Because the web app uses `HashRouter`, product and checkout routes survive static hosting without a server rewrite. The expected URL for this repository is:

`https://trancaodai1651.github.io/FormaForgeDT/`

## External credentials

Supabase SQL must be applied in the supplied project, then `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the public Vite values must be configured in the runtime/deployment environment. SMTP credentials are required before real customer/admin email can be sent. GitHub Pages can host the storefront; it cannot host the Fastify API, so deploy `services/api` separately when production checkout is needed.

See the documentation files for architecture, geometry, hardware, email, database, deployment, desktop and development details.

## API surface

- `GET /health` — reports API and storage mode.
- `GET /api/products` — published product fallback catalog.
- `POST /api/orders` — validates, reprices and persists an order request.
- `GET /api/orders/:id` — retrieves an order confirmation payload.
- `GET /api/admin/orders` — ADMIN-only order queue.
- `PATCH /api/admin/orders/:id` — ADMIN-only status update.
