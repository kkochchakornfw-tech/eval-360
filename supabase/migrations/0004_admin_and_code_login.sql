-- Admin flag: a normal person (role staff, can be evaluated and has scores) who also sees every page.
-- Code login: accounts created by a head with a generated PIN / temporary password, no email needed.
-- must_change_password: forces a new secret on first sign-in.

alter table profiles add column is_admin boolean not null default false;
alter table profiles add column code_login boolean not null default false;
alter table profiles add column must_change_password boolean not null default false;

-- Everything a head can do, an admin can do too (policies and RPCs all go through is_head()).
create or replace function is_head() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and is_active and (role = 'head' or is_admin)
  )
$$;

-- An admin is not a head: only real heads may submit the Job Base / KPI assessment.
create or replace function submit_head_assessment(
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
  if not exists (select 1 from profiles where id = v_assessor and role = 'head') then
    raise exception 'บัญชีแอดมินไม่ใช่หัวหน้า ไม่สามารถกรอกแบบประเมินหัวหน้าได้';
  end if;

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
