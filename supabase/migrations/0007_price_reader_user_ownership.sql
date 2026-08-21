-- Price reader records belong to the signed-in customer who created them.
-- Existing rows from the admin-only version remain with a NULL user_id and are
-- intentionally not exposed through the customer routes.
alter table public.price_reader_products
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.price_reader_products
  drop constraint if exists price_reader_products_normalized_url_key;

create unique index if not exists price_reader_products_user_url_key
  on public.price_reader_products(user_id, normalized_url);

create index if not exists price_reader_products_user_idx
  on public.price_reader_products(user_id, updated_at desc);
