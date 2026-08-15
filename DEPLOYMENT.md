# Deployment

## Temporary web host

Push to `main`; GitHub Actions builds and publishes `apps/web/dist` to GitHub Pages. Enable Pages in repository settings with “GitHub Actions” as the source. The static web works without backend data for browsing and customization; checkout requires `VITE_API_URL` to be configured at build time.

## API

Deploy `services/api` to a Node-capable host. Set its environment variables from `.env.production.example`, including Supabase service-role access and SMTP. Restrict CORS to the storefront origin before production.

## Supabase

Run the migration in Supabase SQL Editor, configure a public anon key only for future public reads, and keep the service role key exclusively in the API environment.
