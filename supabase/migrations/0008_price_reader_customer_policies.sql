-- Allow signed-in customers and the Chrome extension to manage only their own price snapshots.
alter table public.price_reader_products enable row level security;
alter table public.price_reader_snapshots enable row level security;

drop policy if exists price_reader_products_select_own on public.price_reader_products;
create policy price_reader_products_select_own on public.price_reader_products
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists price_reader_products_insert_own on public.price_reader_products;
create policy price_reader_products_insert_own on public.price_reader_products
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists price_reader_products_update_own on public.price_reader_products;
create policy price_reader_products_update_own on public.price_reader_products
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists price_reader_products_delete_own on public.price_reader_products;
create policy price_reader_products_delete_own on public.price_reader_products
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists price_reader_snapshots_select_own on public.price_reader_snapshots;
create policy price_reader_snapshots_select_own on public.price_reader_snapshots
  for select to authenticated using (exists (select 1 from public.price_reader_products p where p.id = product_id and p.user_id = auth.uid()));

drop policy if exists price_reader_snapshots_insert_own on public.price_reader_snapshots;
create policy price_reader_snapshots_insert_own on public.price_reader_snapshots
  for insert to authenticated with check (exists (select 1 from public.price_reader_products p where p.id = product_id and p.user_id = auth.uid()));

drop policy if exists price_reader_snapshots_delete_own on public.price_reader_snapshots;
create policy price_reader_snapshots_delete_own on public.price_reader_snapshots
  for delete to authenticated using (exists (select 1 from public.price_reader_products p where p.id = product_id and p.user_id = auth.uid()));
