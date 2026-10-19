-- Permanently remove a person and every evaluation they gave or received (head only, one transaction).
create function delete_person(p_id uuid) returns void
language plpgsql set search_path = public as $$
begin
  if not is_head() then raise exception 'เฉพาะหัวหน้าเท่านั้น'; end if;
  if p_id = auth.uid() then raise exception 'ไม่สามารถลบตัวเองได้'; end if;

  delete from head_assessments where assessor_id = p_id or evaluatee_id = p_id;
  delete from evaluations where evaluator_id = p_id or evaluatee_id = p_id;
  delete from profiles where id = p_id;
end $$;

revoke all on function delete_person(uuid) from public, anon;
grant execute on function delete_person(uuid) to authenticated;
