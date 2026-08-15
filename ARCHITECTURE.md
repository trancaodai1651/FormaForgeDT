# Architecture decisions

## Monorepo boundaries

- `apps/web`: customer and studio UI, static-deployable and HashRouter-based.
- `services/api`: only server boundary for trusted pricing, orders, email and Supabase service-role access.
- `packages/types`: Zod contracts shared by browser, API and geometry code.
- `packages/geometry`: pure TypeScript geometry primitives with no DOM dependency; suitable for a Web Worker or Tauri command later.
- `apps/desktop/src-tauri`: Tauri 2 shell and the future offline filesystem/export boundary.

## Data and trust

Supabase owns the PostgreSQL data model. The API uses the service role only on the server. The browser never sends a trusted total; the API resolves product, color and base prices again before creating an order. Demo catalog data is deliberately typed and replaceable, not mixed into order pricing logic.

## Why static web + API

GitHub Pages is a good temporary host for the storefront but cannot run Node or SMTP. The web therefore remains a static experience and calls `VITE_API_URL` for real checkout. Deploying the API separately keeps secrets away from the browser and preserves a path to Supabase Edge Functions or a container platform later.

## Geometry decisions

The first engine exposes independent stages and a lightweight preview mesh. Solid boolean operations and manufacturing-grade mesh repair are intentionally kept behind the same API boundary; they can be replaced with a Rust/OpenCascade/WASM implementation without changing product or viewer contracts.

## Security notes

Fastify applies CORS, security headers, rate limiting and Zod validation. SMTP and Supabase service-role secrets are excluded from Git. Admin routes are visually present in the MVP but production authorization must be enabled before exposing admin data publicly.
