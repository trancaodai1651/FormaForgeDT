-- Hometown Modular Lamp / Supabase Postgres schema
-- Run this file in the Supabase SQL Editor. It is idempotent and keeps binary assets outside Postgres.
create extension if not exists "pgcrypto";

create type public.order_status as enum ('PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED', 'CANCELLED');
create type public.user_role as enum ('ADMIN', 'CUSTOMER');

create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  current_identity text not null,
  historical_identity text,
  aliases text[] not null default '{}',
  former_province text,
  merged_from text[] not null default '{}',
  effective_date date,
  collection_version text not null default '2026.1',
  created_at timestamptz not null default now()
);
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  province_id uuid references public.provinces(id), description text not null default '', story text not null default '',
  cover_image text, hero_model text, created_at timestamptz not null default now()
);
create table if not exists public.hardware (
  id uuid primary key default gen_random_uuid(), code text unique not null, name text not null, kind text not null,
  specifications jsonb not null default '{}', reference_url text, verified_at timestamptz
);
create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, hex text not null, price_delta integer not null default 0
);
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  specifications jsonb not null default '{}'
);
create table if not exists public.print_profiles (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  specifications jsonb not null default '{}'
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), slug text unique not null, sku text unique not null, name text not null,
  description text not null default '', story text not null default '', category text not null default 'modular',
  collection_id uuid references public.collections(id), province_id uuid references public.provinces(id), price integer not null check (price >= 0),
  hero_image text, gallery text[] not null default '{}', model_3d text, technical_image text,
  dimensions jsonb not null default '{}', weight numeric not null default 0, print_time text not null default '',
  shape text not null default 'modular', featured boolean not null default false, published boolean not null default false,
  stock_status text not null default 'made-to-order', material_id uuid references public.materials(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.product_colors (product_id uuid references public.products(id) on delete cascade, color_id uuid references public.colors(id), primary key (product_id, color_id));
create table if not exists public.product_hardware (product_id uuid references public.products(id) on delete cascade, hardware_id uuid references public.hardware(id), primary key (product_id, hardware_id));
create table if not exists public.users (id uuid primary key references auth.users(id) on delete cascade, role public.user_role not null default 'CUSTOMER', display_name text, created_at timestamptz not null default now());
create table if not exists public.customers (id uuid primary key default gen_random_uuid(), user_id uuid references public.users(id), name text not null, email text not null, phone text not null, address text not null, created_at timestamptz not null default now());
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), order_number text unique not null, status public.order_status not null default 'PENDING',
  customer_id uuid references public.customers(id), customer_name text not null, customer_email text not null, customer_phone text not null,
  shipping_address text not null, note text not null default '', total integer not null check (total >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id),
  product_name text not null, color_id text not null, color_name text not null, base text not null, quantity integer not null check (quantity between 1 and 20),
  unit_price integer not null check (unit_price >= 0), line_total integer not null check (line_total >= 0)
);
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(), order_id uuid references public.orders(id) on delete set null, recipient text not null,
  provider text not null, status text not null, error_message text, sent_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.lamp_designs (
  id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id), version text not null default 'v1',
  original_shape jsonb not null default '{}', parameters jsonb not null default '{}', generated_geometry jsonb not null default '{}',
  published boolean not null default false, created_at timestamptz not null default now(), unique(product_id, version)
);
create table if not exists public.design_projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.users(id), name text not null,
  version integer not null default 1, project jsonb not null default '{}', autosaved_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists public.contact_settings (
  id boolean primary key default true, shop_name text not null default 'Hometown Modular Lamp', owner_name text, email text, phone text,
  facebook text, zalo text, website text, address text, social_links jsonb not null default '{}', updated_at timestamptz not null default now(), check (id)
);

insert into public.provinces (name, current_identity, historical_identity, aliases) values
  ('Phú Yên', 'Phú Yên', 'Phú Yên', array['Phu Yen']), ('Hà Nội', 'Hà Nội', 'Hà Nội', array['Ha Noi']),
  ('TP.HCM', 'Thành phố Hồ Chí Minh', 'TP.HCM', array['Ho Chi Minh City']), ('Đắk Lắk', 'Đắk Lắk', 'Đắk Lắk', array['Dak Lak']), ('Huế', 'Huế', 'Thừa Thiên Huế', array['Hue'])
on conflict do nothing;
insert into public.colors (slug, name, hex, price_delta) values
  ('porcelain', 'Porcelain', '#e8e5db', 0), ('obsidian', 'Obsidian', '#17181a', 0), ('sand', 'Sand', '#c7a986', 80000), ('lacquer-red', 'Lacquer red', '#9b3a31', 80000), ('deep-sea', 'Deep sea', '#315b67', 80000), ('jade', 'Jade', '#607c6d', 80000)
on conflict do nothing;
insert into public.hardware (code, name, kind, specifications, reference_url) values
  ('E27', 'E27 socket adapter', 'socket', '{"socketDiameter":42,"socketHeight":55,"clearance":1.2,"heatClearance":12,"cablePassage":10}', 'https://en.wikipedia.org/wiki/Edison_screw'),
  ('BAMBU_LED_KIT_001', 'Bambu Lab LED Kit 001 adapter', 'led', '{"moduleDiameter":45,"moduleHeight":18,"mountDiameter":48,"clearance":0.6,"heatClearance":8,"cablePassage":8}', null),
  ('CORE_BAYONET', 'Hometown Core Bayonet', 'connector', '{"diameter":52,"height":8,"lockAngle":35,"clearance":0.35}', null)
on conflict do nothing;
insert into public.materials (slug, name, specifications) values
  ('pla-matte', 'PLA matte', '{"temperature":210,"cooling":80,"layerHeight":0.2,"minWall":1.2,"maxOverhang":55}'),
  ('petg-translucent', 'PETG translucent', '{"temperature":240,"cooling":45,"layerHeight":0.2,"minWall":1.4,"maxOverhang":50}')
on conflict do nothing;
insert into public.print_profiles (slug, name, specifications) values ('bambu-a1-04', 'Bambu A1 / 0.4 mm', '{"nozzleDiameter":0.4,"minimumFeature":0.8,"minimumWall":1.2,"minimumGap":0.8,"recommendedLayerHeight":0.2,"recommendedOverhang":55,"bridgeLimit":10}') on conflict do nothing;
insert into public.contact_settings (shop_name, email, phone, website, address) values ('Hometown Modular Lamp', 'hello@hometownlamp.com', '+84 900 000 000', 'https://hometownlamp.com', 'Việt Nam') on conflict (id) do nothing;

alter table public.products enable row level security;
alter table public.collections enable row level security;
alter table public.provinces enable row level security;
alter table public.colors enable row level security;
create policy "published products are public" on public.products for select using (published = true);
create policy "collections are public" on public.collections for select using (true);
create policy "provinces are public" on public.provinces for select using (true);
create policy "colors are public" on public.colors for select using (true);
