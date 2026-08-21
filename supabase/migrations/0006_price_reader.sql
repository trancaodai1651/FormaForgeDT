-- Price reader snapshots are written by the admin API using the service role.
-- No public policy is created: product source data is an admin workspace concern.
create table if not exists public.price_reader_products (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('taobao', 'tmall', '1688', 'pinduoduo', 'jd', 'xiaohongshu', 'unknown')),
  source_label text not null,
  source_product_id text not null,
  url text not null,
  normalized_url text not null unique,
  title text not null default '',
  image_url text,
  shop_name text,
  provider text not null default 'unconfigured',
  exchange_rate_vnd numeric not null default 3500 check (exchange_rate_vnd > 0),
  variants jsonb not null default '[]'::jsonb,
  promotions jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_reader_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.price_reader_products(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now()
);

create index if not exists price_reader_products_source_idx on public.price_reader_products(source);
create index if not exists price_reader_products_updated_idx on public.price_reader_products(updated_at desc);
create index if not exists price_reader_snapshots_product_idx on public.price_reader_snapshots(product_id, captured_at desc);

alter table public.price_reader_products enable row level security;
alter table public.price_reader_snapshots enable row level security;
