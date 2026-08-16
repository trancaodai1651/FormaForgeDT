-- The admin guard reads the signed-in user's role from public.users.
-- Keep RLS enabled while allowing each authenticated user to read only their own profile.
alter table public.users enable row level security;

drop policy if exists "Users can read their own profile" on public.users;
create policy "Users can read their own profile"
  on public.users
  for select
  to authenticated
  using (auth.uid() = id);
