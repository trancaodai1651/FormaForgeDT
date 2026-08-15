# Database

Apply `supabase/migrations/0001_hometown_lamp.sql` followed by `supabase/migrations/0002_catalog_seed.sql` in the supplied Supabase project. The first migration creates the schema; the second seeds the initial 3 collections, 5 published products, color compatibility and hardware compatibility without replacing existing orders or assets.

The migrations enable public reads for published/catalog data. Orders are written by the API with the Supabase service role; do not expose that key to Vite. The API resolves catalog SKUs to database UUIDs before inserting order items, so foreign-key integrity is preserved. With service-role credentials, the API reads the published catalog from Supabase; without them it uses the checked-in catalog for local UI work and reports that mode through `/health`.

The production project used by this workspace has both migrations applied. For a new project, run them in numeric order from the Supabase SQL Editor or your migration runner.
