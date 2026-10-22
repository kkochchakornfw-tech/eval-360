-- PIN accounts are back. They are created by the server with the service role (auth.admin.createUser)
-- under an internal address `<profile-id>@pin.eval360.local` that the server first writes onto a
-- roster profile that has no account yet. Migration 0006 rejected every non-Google sign-up, which
-- would also block that. Allow exactly this case and nothing else:
--   * the new user's email ends with @pin.eval360.local, and
--   * a roster profile without an account already carries that exact email.
-- The profile id inside the address is unguessable, so a stranger using the public sign-up endpoint
-- cannot hit it, and ordinary email/password sign-up (profile creation or roster takeover) stays closed.
--
-- Escape hatch for one-off admin work (SQL editor, tests): `set app.allow_password_signup = 'on'`.

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pending uuid;
  v_provider text := coalesce(to_jsonb(new) -> 'raw_app_meta_data' ->> 'provider', '');
  v_open boolean := coalesce(current_setting('app.allow_password_signup', true), '') = 'on';
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
    where not has_account and lower(email) = lower(new.email)
      and (v_open or lower(email) like '%@pin.eval360.local')
    limit 1;

  if v_pending is not null then
    perform set_config('app.relinking', 'on', true);
    update profiles set id = new.id, has_account = true, email = new.email where id = v_pending;
    return new;
  end if;

  if not v_open then
    raise exception 'ระบบไม่เปิดสมัครด้วยตนเอง กรุณาติดต่อหัวหน้า';
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
