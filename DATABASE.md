# Database

Apply `supabase/migrations/0001_hometown_lamp.sql` in the supplied Supabase project. The schema covers the requested product, collection, province history, hardware, colors, materials, orders, customers, email logs, design projects, lamp design versions, print profiles and contact settings.

The migration enables public reads for published/catalog data. Orders are written by the API with the Supabase service role; do not expose that key to Vite. The API has a memory mode for local UI work when no Supabase credentials are present, and reports that mode through `/health`.
