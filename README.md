# FormaForgeDT

Public-first 3D creation toolbox for designing, previewing and exporting printable models in the browser.

## Current product surface

- Vite + React + TypeScript public toolbox with HashRouter routes for Clicker Lab, MeKey Studio, Multi Color, SVG Layers, Flex workspaces, Module Studio, Paramacraft, Price Reader and the downloads catalog.
- React Three Fiber viewer with orbit controls, realtime color/light controls and a parametric lamp mesh.
- `@hometown/geometry` pipeline primitives: profile normalization, shape generation, mesh generation, FDM validation, STL export and GLB metadata export.
- Supabase-compatible Postgres migration with product, collection, province, hardware, order, email, design-project and settings models.
- Fastify API with server-side price calculation, rate limiting, validation, Supabase catalog/order persistence when configured, protected admin operations and SMTP email provider.
- Public price reader for Taobao, Tmall, 1688, Pinduoduo, JD and Xiaohongshu links, with CNY/VND conversion and a configurable licensed data-provider adapter.
- Tauri 2 desktop shell configured for Windows NSIS and macOS DMG targets.
- Responsive Module Lamp Studio at `#/module-studio`: draw a profile, generate a live 3D shade, arrange configurable modules, select E27 or Bambu LED Kit 001 hardware, choose printable joints, and export a project or STL.
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

All creation workspaces are available without an account. Optional API-backed price inspection uses `VITE_API_URL`; geometry preview and browser exports remain local-first.

## Routes

`/`, `/downloads`, `/clicker`, `/mekey-studio`, `/multi-color`, `/svg-layers`, `/flex-keychain`, `/flex-organizer`, `/flex-lamp`, `/tulip-creator`, `/home-item`, `/paramacraft`, `/module-studio`, `/hunyuan-3d`, `/split-3mf`, `/price-reader`.

## GitHub Pages

The `deploy-pages.yml` workflow publishes `apps/web/dist` on every push to `main`. Because the web app uses `HashRouter`, product and checkout routes survive static hosting without a server rewrite. The expected URL for this repository is:

`https://trancaodai1651.github.io/FormaForgeDT/`

## External credentials

Supabase/API values are optional for the public browser workspaces. GitHub Pages hosts the static toolbox; deploy `services/api` separately when live marketplace data is needed.

See the documentation files for architecture, geometry, hardware, email, database, deployment, desktop and development details.

## API surface

Public price inspection and optional authenticated tracking routes:

- `POST /api/price-reader/inspect`
- `GET /api/price-reader/products`
- `POST /api/price-reader/products`
- `POST /api/price-reader/products/:id/refresh`
- `DELETE /api/price-reader/products/:id`

- `POST /api/admin/price-reader/inspect` — ADMIN-only link inspection and current quote lookup.
- `GET /api/admin/price-reader/products` — ADMIN-only tracked product snapshots.
- `POST /api/admin/price-reader/products` — ADMIN-only save and refresh a product quote.
- `POST /api/admin/price-reader/products/:id/refresh` — ADMIN-only refresh a saved quote.
- `DELETE /api/admin/price-reader/products/:id` — ADMIN-only remove a saved quote.

- `GET /health` — reports API and storage mode.
- `GET /api/products` — published product fallback catalog.
- `POST /api/orders` — validates, reprices and persists an order request.
- `GET /api/orders/:id` — retrieves an order confirmation payload.
- `GET /api/admin/orders` — ADMIN-only order queue.
- `PATCH /api/admin/orders/:id` — ADMIN-only status update.
## Tải ứng dụng

Mở trang [`/#/downloads`](https://trancaodai1651.github.io/FormaForgeDT/#/downloads) để tải web companion, Windows installer, macOS DMG và Chrome Market Reader. Installer/extension được đính kèm trong [GitHub Releases](https://github.com/trancaodai1651/FormaForgeDT/releases/latest), không commit binary nặng vào source.

Push tag `v*` sẽ chạy `.github/workflows/release-desktop.yml` để build NSIS/DMG và package extension.
