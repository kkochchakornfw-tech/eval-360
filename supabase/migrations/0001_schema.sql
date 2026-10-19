-- Eval 360: schema, triggers, RPCs
-- Region: ap-southeast-1

create type user_role as enum ('head', 'staff');

create table staff_groups (
  id serial primary key,
  name text not null,
  sort_order int not null default 0
);

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null unique,
  full_name text not null,
  role user_role not null default 'staff',
  staff_group_id int references staff_groups,
  counts_in_score boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- staff must belong to a group; heads never do
  check (role <> 'head' or staff_group_id is null)
);

create table eval_cycles (
  id serial primary key,
  name text not null,
  is_open boolean not null default true,
  is_current boolean not null default false,
  head_weight numeric not null default 50 check (head_weight between 0 and 100),
  core_weight numeric not null default 30 check (core_weight >= 0),
  job_weight numeric not null default 35 check (job_weight >= 0),
  kpi_weight numeric not null default 35 check (kpi_weight >= 0),
  created_at timestamptz not null default now(),
  check (core_weight + job_weight + kpi_weight = 100)
);
create unique index eval_cycles_one_current on eval_cycles (is_current) where is_current;

create table core_groups (
  id serial primary key,
  cycle_id int not null references eval_cycles on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0
);

create table core_questions (
  id serial primary key,
  group_id int not null references core_groups on delete cascade,
  text text not null,
  sort_order int not null default 0
);

create table job_items (
  id serial primary key,
  cycle_id int not null references eval_cycles on delete cascade,
  staff_group_id int not null references staff_groups,
  text text not null,
  weight numeric not null check (weight > 0),
  sort_order int not null default 0
);

create table evaluations (
  id bigserial primary key,
  cycle_id int not null references eval_cycles,
  evaluator_id uuid not null references profiles,
  evaluatee_id uuid not null references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, evaluator_id, evaluatee_id),
  check (evaluator_id <> evaluatee_id)
);
create index evaluations_evaluatee_idx on evaluations (cycle_id, evaluatee_id);

create table core_answers (
  evaluation_id bigint not null references evaluations on delete cascade,
  question_id int not null references core_questions on delete cascade,
  score smallint not null check (score between 1 and 5),
  primary key (evaluation_id, question_id)
);

create table head_assessments (
  id bigserial primary key,
  cycle_id int not null references eval_cycles,
  assessor_id uuid not null references profiles,
  evaluatee_id uuid not null references profiles,
  kpi_percent numeric not null check (kpi_percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (cycle_id, assessor_id, evaluatee_id),
  check (assessor_id <> evaluatee_id)
);

create table job_answers (
  head_assessment_id bigint not null references head_assessments on delete cascade,
  job_item_id int not null references job_items on delete cascade,
  score smallint not null check (score between 1 and 5),
  primary key (head_assessment_id, job_item_id)
);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so they can read profiles without recursion)
-- ---------------------------------------------------------------------------
create function is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_active)
$$;

create function is_head() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_active and role = 'head'
  )
$$;

create function cycle_is_open(p_cycle_id int) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_open from eval_cycles where id = p_cycle_id), false)
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger evaluations_touch before update on evaluations
  for each row execute function touch_updated_at();
create trigger head_assessments_touch before update on head_assessments
  for each row execute function touch_updated_at();

-- New auth user -> profile. Metadata is only read here, at creation (self sign-up is disabled).
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
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

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Heads can never be evaluated; closed cycles are write-protected for non-heads.
create function check_evaluation_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
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

create trigger evaluations_check before insert or update on evaluations
  for each row execute function check_evaluation_write();

create function check_assessment_write() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = new.assessor_id and role = 'head') then
    raise exception 'ผู้ประเมินต้องเป็นหัวหน้า';
  end if;
  if exists (select 1 from profiles where id = new.evaluatee_id and role = 'head') then
    raise exception 'ไม่สามารถประเมินหัวหน้าได้';
  end if;
  return new;
end $$;

create trigger head_assessments_check before insert or update on head_assessments
  for each row execute function check_assessment_write();

-- Answers must belong to the same cycle as their parent record
create function check_core_answer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_eval_cycle int; v_q_cycle int;
begin
  select cycle_id into v_eval_cycle from evaluations where id = new.evaluation_id;
  select g.cycle_id into v_q_cycle
    from core_questions q join core_groups g on g.id = q.group_id where q.id = new.question_id;
  if v_eval_cycle is distinct from v_q_cycle then
    raise exception 'คำถามไม่ตรงกับรอบประเมิน';
  end if;
  if not is_head() and not cycle_is_open(v_eval_cycle) then
    raise exception 'รอบประเมินปิดแล้ว';
  end if;
  return new;
end $$;

create trigger core_answers_check before insert or update on core_answers
  for each row execute function check_core_answer();

create function check_job_answer() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cycle int; v_group int; v_item_cycle int; v_item_group int;
begin
  select a.cycle_id, p.staff_group_id into v_cycle, v_group
    from head_assessments a join profiles p on p.id = a.evaluatee_id
    where a.id = new.head_assessment_id;
  select cycle_id, staff_group_id into v_item_cycle, v_item_group
    from job_items where id = new.job_item_id;
  if v_cycle is distinct from v_item_cycle or v_group is distinct from v_item_group then
    raise exception 'ข้อ Job Base ไม่ตรงกับรอบหรือกลุ่มของผู้รับการประเมิน';
  end if;
  return new;
end $$;

create trigger job_answers_check before insert or update on job_answers
  for each row execute function check_job_answer();

-- Exactly one current cycle: setting a new one clears the others
create function enforce_single_current() returns trigger
language plpgsql as $$
begin
  if new.is_current then
    update eval_cycles set is_current = false where is_current and id <> new.id;
  end if;
  return new;
end $$;

create trigger eval_cycles_single_current before insert or update on eval_cycles
  for each row execute function enforce_single_current();

-- ---------------------------------------------------------------------------
-- RPCs (security invoker: RLS and triggers apply to the caller)
-- ---------------------------------------------------------------------------

-- p_answers: {"<question_id>": score, ...}
create function submit_evaluation(
  p_cycle_id int,
  p_evaluatee_id uuid,
  p_answers jsonb,
  p_evaluator_id uuid default null
) returns bigint
language plpgsql set search_path = public as $$
declare v_evaluator uuid; v_id bigint;
begin
  v_evaluator := coalesce(p_evaluator_id, auth.uid());
  if v_evaluator is null then raise exception 'ไม่ได้ล็อกอิน'; end if;
  if v_evaluator <> auth.uid() and not is_head() then
    raise exception 'ไม่มีสิทธิ์บันทึกแทนผู้อื่น';
  end if;

  if exists (
    select 1 from core_questions q join core_groups g on g.id = q.group_id
    where g.cycle_id = p_cycle_id and not (p_answers ? q.id::text)
  ) then
    raise exception 'กรุณาให้คะแนนให้ครบทุกข้อ';
  end if;

  insert into evaluations (cycle_id, evaluator_id, evaluatee_id)
  values (p_cycle_id, v_evaluator, p_evaluatee_id)
  on conflict (cycle_id, evaluator_id, evaluatee_id) do update set updated_at = now()
  returning id into v_id;

  insert into core_answers (evaluation_id, question_id, score)
  select v_id, e.key::int, e.value::smallint from jsonb_each_text(p_answers) e
  on conflict (evaluation_id, question_id) do update set score = excluded.score;

  return v_id;
end $$;

-- Head form: Core + Job Base + KPI in one transaction
create function submit_head_assessment(
  p_cycle_id int,
  p_evaluatee_id uuid,
  p_core jsonb,
  p_job jsonb,
  p_kpi numeric,
  p_assessor_id uuid default null
) returns bigint
language plpgsql set search_path = public as $$
declare v_assessor uuid; v_id bigint; v_group int;
begin
  if not is_head() then raise exception 'เฉพาะหัวหน้าเท่านั้น'; end if;
  v_assessor := coalesce(p_assessor_id, auth.uid());

  select staff_group_id into v_group from profiles where id = p_evaluatee_id;

  if exists (
    select 1 from job_items j
    where j.cycle_id = p_cycle_id and j.staff_group_id = v_group and not (p_job ? j.id::text)
  ) then
    raise exception 'กรุณาให้คะแนน Job Base ให้ครบทุกข้อ';
  end if;

  perform submit_evaluation(p_cycle_id, p_evaluatee_id, p_core, v_assessor);

  insert into head_assessments (cycle_id, assessor_id, evaluatee_id, kpi_percent)
  values (p_cycle_id, v_assessor, p_evaluatee_id, p_kpi)
  on conflict (cycle_id, assessor_id, evaluatee_id)
    do update set kpi_percent = excluded.kpi_percent, updated_at = now()
  returning id into v_id;

  insert into job_answers (head_assessment_id, job_item_id, score)
  select v_id, e.key::int, e.value::smallint from jsonb_each_text(p_job) e
  on conflict (head_assessment_id, job_item_id) do update set score = excluded.score;

  return v_id;
end $$;

-- Delete one evaluator -> evaluatee record (core + head assessment). Head only.
create function delete_evaluation_record(
  p_cycle_id int, p_evaluator_id uuid, p_evaluatee_id uuid
) returns void
language plpgsql set search_path = public as $$
begin
  if not is_head() then raise exception 'เฉพาะหัวหน้าเท่านั้น'; end if;
  delete from evaluations
    where cycle_id = p_cycle_id and evaluator_id = p_evaluator_id and evaluatee_id = p_evaluatee_id;
  delete from head_assessments
    where cycle_id = p_cycle_id and assessor_id = p_evaluator_id and evaluatee_id = p_evaluatee_id;
end $$;

-- Create a new cycle copying questions, job items and weights from the latest one
create function create_cycle_from_latest(p_name text) returns int
language plpgsql set search_path = public as $$
declare v_src eval_cycles; v_new int; g record; v_gid int;
begin
  if not is_head() then raise exception 'เฉพาะหัวหน้าเท่านั้น'; end if;
  select * into v_src from eval_cycles order by id desc limit 1;

  insert into eval_cycles (name, is_open, is_current, head_weight, core_weight, job_weight, kpi_weight)
  values (
    p_name, true, false,
    coalesce(v_src.head_weight, 50), coalesce(v_src.core_weight, 30),
    coalesce(v_src.job_weight, 35), coalesce(v_src.kpi_weight, 35)
  ) returning id into v_new;

  if v_src.id is not null then
    for g in select * from core_groups where cycle_id = v_src.id order by sort_order, id loop
      insert into core_groups (cycle_id, code, name, sort_order)
      values (v_new, g.code, g.name, g.sort_order) returning id into v_gid;
      insert into core_questions (group_id, text, sort_order)
      select v_gid, text, sort_order from core_questions where group_id = g.id;
    end loop;
    insert into job_items (cycle_id, staff_group_id, text, weight, sort_order)
    select v_new, staff_group_id, text, weight, sort_order from job_items where cycle_id = v_src.id;
  end if;
  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- Directory view: non-sensitive columns for every active user (no email)
-- ---------------------------------------------------------------------------
create view directory as
  select id, full_name, staff_group_id, role
  from profiles
  where is_active and is_active_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table staff_groups enable row level security;
alter table profiles enable row level security;
alter table eval_cycles enable row level security;
alter table core_groups enable row level security;
alter table core_questions enable row level security;
alter table job_items enable row level security;
alter table evaluations enable row level security;
alter table core_answers enable row level security;
alter table head_assessments enable row level security;
alter table job_answers enable row level security;

-- profiles: head full access; everyone may read only their own row
create policy profiles_head_all on profiles for all to authenticated
  using (is_head()) with check (is_head());
create policy profiles_self_read on profiles for select to authenticated
  using (id = auth.uid() and is_active);

-- reference data: readable by every active user, writable by head
create policy staff_groups_read on staff_groups for select to authenticated using (is_active_user());
create policy staff_groups_write on staff_groups for all to authenticated
  using (is_head()) with check (is_head());
create policy eval_cycles_read on eval_cycles for select to authenticated using (is_active_user());
create policy eval_cycles_write on eval_cycles for all to authenticated
  using (is_head()) with check (is_head());
create policy core_groups_read on core_groups for select to authenticated using (is_active_user());
create policy core_groups_write on core_groups for all to authenticated
  using (is_head()) with check (is_head());
create policy core_questions_read on core_questions for select to authenticated using (is_active_user());
create policy core_questions_write on core_questions for all to authenticated
  using (is_head()) with check (is_head());

-- job items: head only
create policy job_items_head on job_items for all to authenticated
  using (is_head()) with check (is_head());

-- evaluations
create policy evaluations_head on evaluations for all to authenticated
  using (is_head()) with check (is_head());
create policy evaluations_staff_select on evaluations for select to authenticated
  using (is_active_user() and evaluator_id = auth.uid());
create policy evaluations_staff_insert on evaluations for insert to authenticated
  with check (is_active_user() and evaluator_id = auth.uid() and cycle_is_open(cycle_id));
create policy evaluations_staff_update on evaluations for update to authenticated
  using (is_active_user() and evaluator_id = auth.uid() and cycle_is_open(cycle_id))
  with check (evaluator_id = auth.uid() and cycle_is_open(cycle_id));

-- core answers follow their evaluation
create policy core_answers_head on core_answers for all to authenticated
  using (is_head()) with check (is_head());
create policy core_answers_staff_select on core_answers for select to authenticated
  using (is_active_user() and exists (
    select 1 from evaluations e where e.id = evaluation_id and e.evaluator_id = auth.uid()));
create policy core_answers_staff_insert on core_answers for insert to authenticated
  with check (is_active_user() and exists (
    select 1 from evaluations e
    where e.id = evaluation_id and e.evaluator_id = auth.uid() and cycle_is_open(e.cycle_id)));
create policy core_answers_staff_update on core_answers for update to authenticated
  using (is_active_user() and exists (
    select 1 from evaluations e
    where e.id = evaluation_id and e.evaluator_id = auth.uid() and cycle_is_open(e.cycle_id)))
  with check (exists (
    select 1 from evaluations e
    where e.id = evaluation_id and e.evaluator_id = auth.uid() and cycle_is_open(e.cycle_id)));

-- head assessments: head only
create policy head_assessments_head on head_assessments for all to authenticated
  using (is_head()) with check (is_head());
create policy job_answers_head on job_answers for all to authenticated
  using (is_head()) with check (is_head());

-- ---------------------------------------------------------------------------
-- Grants: authenticated only; anon gets nothing
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select on directory to authenticated;
grant execute on all functions in schema public to authenticated;
