-- Google sign-in. A head records each person's Google address on the roster (google_email).
-- The first time that person signs in with Google, Supabase creates an auth user and this trigger
-- re-links the roster profile to it (keeping every evaluation). Google accounts that are not on the
-- roster are rejected, so there is still no open self sign-up.

alter table profiles add column google_email text;
create unique index profiles_google_email_key on profiles (lower(google_email));

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pending uuid;
  v_provider text := coalesce(to_jsonb(new) -> 'raw_app_meta_data' ->> 'provider', '');
begin
  if v_provider = 'google' then
    select id into v_pending from profiles
      where is_active and lower(google_email) = lower(new.email) limit 1;
    if v_pending is null then
      raise exception 'อีเมล Google นี้ไม่อยู่ในรายชื่อ กรุณาติดต่อหัวหน้า';
    end if;
    -- tell the evaluation trigger this is a key change, not a user edit
    perform set_config('app.relinking', 'on', true);
    update profiles
      set id = new.id, has_account = true, email = new.email,
          code_login = false, must_change_password = false
      where id = v_pending;
    return new;
  end if;

  select id into v_pending from profiles
    where not has_account and lower(email) = lower(new.email) limit 1;

  if v_pending is not null then
    perform set_config('app.relinking', 'on', true);
    update profiles set id = new.id, has_account = true, email = new.email where id = v_pending;
    return new;
  end if;

  insert into profiles (id, email, full_name, role, staff_group_id, counts_in_score)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::user_role, 'staff'),
    nullif(new.raw_user_meta_data ->> 'staff_group_id', '')::int,
    coalesce(nullif(new.raw_user_meta_data ->> 'counts_in_score', '')::boolean, true)
  );
  return new;
end $$;
