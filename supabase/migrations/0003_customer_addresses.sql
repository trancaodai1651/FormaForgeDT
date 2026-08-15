-- Customer accounts can keep one or more reusable delivery addresses.
create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'default',
  recipient_name text not null,
  email text not null,
  phone text not null,
  address text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, label)
);

alter table public.customer_addresses enable row level security;

drop policy if exists "Users can read their own addresses" on public.customer_addresses;
create policy "Users can read their own addresses" on public.customer_addresses for select using (auth.uid() = user_id);
drop policy if exists "Users can create their own addresses" on public.customer_addresses;
create policy "Users can create their own addresses" on public.customer_addresses for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own addresses" on public.customer_addresses;
create policy "Users can update their own addresses" on public.customer_addresses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own addresses" on public.customer_addresses;
create policy "Users can delete their own addresses" on public.customer_addresses for delete using (auth.uid() = user_id);

create index if not exists customer_addresses_user_default_idx on public.customer_addresses (user_id, is_default);
