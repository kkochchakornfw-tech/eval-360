-- People can exist before they have a login ("pending"): head adds the whole roster first,
-- then invites each person by email later. When the invited auth user is created, the
-- matching pending profile is re-linked to the new auth id and keeps all its evaluations.

alter table profiles drop constraint profiles_id_fkey;
alter table profiles alter column id set default gen_random_uuid();
alter table profiles alter column email drop not null;
alter table profiles add column has_account boolean not null default true;

-- Foreign keys follow the profile id when it is re-linked
alter table evaluations
  drop constraint evaluations_evaluator_id_fkey,
  drop constraint evaluations_evaluatee_id_fkey,
  add constraint evaluations_evaluator_id_fkey
    foreign key (evaluator_id) references profiles (id) on update cascade,
  add constraint evaluations_evaluatee_id_fkey
    foreign key (evaluatee_id) references profiles (id) on update cascade;

alter table head_assessments
  drop constraint head_assessments_assessor_id_fkey,
  drop constraint head_assessments_evaluatee_id_fkey,
  add constraint head_assessments_assessor_id_fkey
    foreign key (assessor_id) references profiles (id) on update cascade,
  add constraint head_assessments_evaluatee_id_fkey
    foreign key (evaluatee_id) references profiles (id) on update cascade;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pending uuid;
begin
  select id into v_pending from profiles
    where not has_account and lower(email) = lower(new.email) limit 1;

  if v_pending is not null then
    -- tell the evaluation trigger this is a key change, not a user edit
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

create or replace function check_evaluation_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('app.relinking', true) = 'on' then
    return new;
  end if;
  if exists (select 1 from profiles where id = new.evaluatee_id and role = 'head') then
    raise exception 'ไม่สามารถประเมินหัวหน้าได้';
  end if;
  if not exists (select 1 from profiles where id = new.evaluatee_id and is_active) then
    raise exception 'ผู้รับการประเมินถูกปิดใช้งาน';
  end if;
  if not is_head() and not cycle_is_open(new.cycle_id) then
    raise exception 'รอบประเมินปิดแล้ว';
  end if;
  return new;
end $$;
