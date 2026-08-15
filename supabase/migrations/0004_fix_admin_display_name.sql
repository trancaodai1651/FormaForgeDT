-- Restore the administrator display name with valid UTF-8 text.
-- The original bootstrap command was entered through a legacy Windows
-- codepage and stored question marks for the Vietnamese diacritics.
do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where lower(email) = 'trancaodai1651@gmail.com'
  limit 1;

  if target_user_id is not null then
    update auth.users
    set raw_user_meta_data = jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb),
      '{display_name}',
      to_jsonb('Trần Cao Đại'::text),
      true
    )
    where id = target_user_id;

    update public.users
    set display_name = 'Trần Cao Đại'
    where id = target_user_id;
  end if;
end $$;
