# Development

```bash
corepack pnpm install
corepack pnpm dev
corepack pnpm dev:api
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm build
corepack pnpm dev:desktop
```

Use `.env.development.example` as the local template. Geometry unit tests cover normalization, invalid profiles, landmark generation, mesh generation, validation and STL output. Add API/integration tests around Supabase and SMTP when credentials are available.
