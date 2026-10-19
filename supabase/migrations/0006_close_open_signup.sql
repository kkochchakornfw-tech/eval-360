-- Sign-in is Google only, and Supabase sign-up has to stay enabled for Google to create users.
-- That also leaves the public email/password sign-up endpoint open to anyone holding the (public)
-- anon key: it would create a staff profile for a stranger, or re-link a roster profile by email
-- without proving ownership of that mailbox. Reject every non-Google sign-up here.
--
-- Escape hatch for one-off admin work (SQL editor, tests): `set app.allow_password_signup = 'on'`
-- in the same session. API clients cannot set this, so it is not reachable from the internet.

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

  if coalesce(current_setting('app.allow_password_signup', true), '') <> 'on' then
    raise exception 'ระบบเข้าสู่ระบบด้วย Google เท่านั้น ไม่เปิดสมัครด้วยอีเมลและรหัสผ่าน';
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
