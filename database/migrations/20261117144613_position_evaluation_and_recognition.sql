begin;

alter table public.evaluation_criteria add column position_key text not null default '';
drop index if exists public.evaluation_criteria_active_name_uidx;
create unique index evaluation_criteria_active_name_uidx
  on public.evaluation_criteria (position_key, lower(criteria_name)) where is_active;
alter table public.employee_evaluations add column recognized_at timestamptz;
alter table public.employee_evaluations add column recognition_note text;
alter table public.employee_evaluations add column recognized_by_user_id text;

create policy "Restrict criteria reads to evaluation roles" on public.evaluation_criteria as restrictive for select to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager','supervisor','employee'])));
create policy "Require HR to create criteria" on public.evaluation_criteria as restrictive for insert to authenticated
with check ((select public.hris_has_role(array['hr_admin'])));
create policy "Require HR to update criteria" on public.evaluation_criteria as restrictive for update to authenticated
using ((select public.hris_has_role(array['hr_admin']))) with check ((select public.hris_has_role(array['hr_admin'])));
create policy "Require HR to delete criteria" on public.evaluation_criteria as restrictive for delete to authenticated
using ((select public.hris_has_role(array['hr_admin'])));

create function public.save_position_evaluation_criteria(p_position text, p_criteria jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  position text := lower(trim(coalesce(p_position,'')));
  criteria_count integer;
  total numeric;
  valid boolean;
begin
  if not (select public.hris_has_role(array['hr_admin'])) then
    raise exception 'Only HR can save evaluation criteria.' using errcode='42501';
  end if;
  if jsonb_typeof(p_criteria) is distinct from 'array' then raise exception 'Provide a list of criteria.'; end if;

  select count(*), coalesce(sum(round(r.weight,2)),0),
    bool_and(coalesce(length(trim(r.criteria_name)) between 1 and 255 and r.weight between 0 and 100 and r.max_score between 1 and 100, false))
    into criteria_count,total,valid
  from jsonb_populate_recordset(null::public.evaluation_criteria,p_criteria) r;
  if criteria_count = 0 and position = '' then raise exception 'The shared criteria cannot be empty.'; end if;
  if criteria_count <> 0 and (not valid or total <> 100) then
    raise exception 'Enter valid criteria and weights totaling 100 percent.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('evaluation-criteria:'||position,0));
  update public.evaluation_criteria set is_active=false, updated_at=now()
    where position_key=position and is_active;
  insert into public.evaluation_criteria(criteria_name,description,category,weight,max_score,position_key)
    select trim(r.criteria_name),r.description,r.category,r.weight,r.max_score,position
    from jsonb_populate_recordset(null::public.evaluation_criteria,p_criteria) r;
end
$$;
revoke all on function public.save_position_evaluation_criteria(text,jsonb) from public, anon;
grant execute on function public.save_position_evaluation_criteria(text,jsonb) to authenticated;

create or replace function public.check_active_evaluation_criteria_weights()
returns table(total_weight numeric, is_ready boolean, message text)
language sql stable set search_path = '' as $$
  select total, total = 100,
    case when total = 100 then 'Shared criteria weights total 100%.' else 'Shared criteria weights must total 100%.' end
  from (select coalesce(sum(weight),0) total from public.evaluation_criteria where is_active and position_key='') totals
$$;

CREATE OR REPLACE FUNCTION public.create_employee_evaluation_template(p_employee_id text, p_period_start date, p_period_end date, p_period_label text DEFAULT NULL::text, p_evaluator_user_id text DEFAULT NULL::text, p_evaluator_name text DEFAULT NULL::text, p_evaluator_role text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_evaluation_id text;
  v_total_weight numeric;
  v_position_key text;
begin
  select lower(trim(coalesce(position,''))) into v_position_key from public.employees where employee_id=p_employee_id;
  if not found then raise exception 'Employee is outside your evaluation scope.' using errcode='42501'; end if;
  if not exists (select 1 from public.evaluation_criteria where is_active and position_key=v_position_key) then v_position_key := ''; end if;
  -- Make sure active criteria weights total 100%
  select coalesce(sum(weight), 0)
  into v_total_weight
  from public.evaluation_criteria
  where is_active = true and position_key = v_position_key;

  if v_total_weight <> 100 then
    raise exception 'Cannot create evaluation. Active criteria weights total %, not 100.', v_total_weight;
  end if;

  -- Create or update evaluation record
  insert into public.employee_evaluations (
    employee_id,
    employee_name,
    position,
    outlet,
    evaluation_period_start,
    evaluation_period_end,
    evaluation_period_label,
    evaluator_user_id,
    evaluator_name,
    evaluator_role,
    status
  )
  select
    e.employee_id,
    concat_ws(' ', e.first_name, e.middle_name, e.last_name, e.suffix),
    e.position,
    e.outlet,
    p_period_start,
    p_period_end,
    p_period_label,
    p_evaluator_user_id,
    p_evaluator_name,
    p_evaluator_role,
    'Draft'
  from public.employees e
  where e.employee_id = p_employee_id

  on conflict (employee_id, evaluation_period_start, evaluation_period_end)
  do update set
    employee_name = excluded.employee_name,
    position = excluded.position,
    outlet = excluded.outlet,
    evaluation_period_label = excluded.evaluation_period_label,
    evaluator_user_id = excluded.evaluator_user_id,
    evaluator_name = excluded.evaluator_name,
    evaluator_role = excluded.evaluator_role,
    updated_at = now()
  where employee_evaluations.status in ('Draft', 'Returned')
  returning evaluation_id into v_evaluation_id;

  if v_evaluation_id is null then
    raise exception 'A submitted or approved evaluation already exists for this employee and period. Choose a different period.';
  end if;

  -- Existing drafts retain the criteria snapshot assigned when they were created.
  if exists (select 1 from public.employee_evaluation_scores where evaluation_id = v_evaluation_id) then
    return v_evaluation_id;
  end if;

  -- Add active criteria as score rows
  insert into public.employee_evaluation_scores (
    evaluation_id,
    criteria_id,
    criteria_name,
    criteria_weight,
    max_score,
    raw_score,
    weighted_score
  )
  select
    v_evaluation_id,
    ec.criteria_id,
    ec.criteria_name,
    ec.weight,
    ec.max_score,
    0,
    0
  from public.evaluation_criteria ec
  where ec.is_active = true and ec.position_key = v_position_key

  on conflict (evaluation_id, criteria_id)
  do update set
    criteria_name = excluded.criteria_name,
    criteria_weight = excluded.criteria_weight,
    max_score = excluded.max_score,
    updated_at = now();

  return v_evaluation_id;
end;
$function$;



create function hris_private.guard_employee_recognition()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' then
    if new.recognized_at is not null or new.recognition_note is not null or new.recognized_by_user_id is not null then
      raise exception 'Recognition requires an approved evaluation.';
    end if;
    return new;
  end if;
  if (new.recognized_at, new.recognition_note, new.recognized_by_user_id) is distinct from
     (old.recognized_at, old.recognition_note, old.recognized_by_user_id) then
    if not (select public.hris_has_role(array['general_manager'])) then
      raise exception 'Only the General Manager can approve recognition.' using errcode='42501';
    end if;
    if old.status <> 'Approved' or new.status <> 'Approved' or old.recognized_at is not null
        or length(trim(coalesce(new.recognition_note,''))) not between 1 and 300 then
      raise exception 'Recognition requires an approved evaluation and a note of 1 to 300 characters.';
    end if;
    new.recognized_at := now();
    select user_id into new.recognized_by_user_id from public.user_accounts
      where auth_user_id=auth.uid() and is_active and role='general_manager' limit 1;
  elsif old.recognized_at is not null and new.status <> 'Approved' then
    raise exception 'An evaluation with approved recognition must remain approved.';
  end if;
  return new;
end
$$;
revoke all on function hris_private.guard_employee_recognition() from public, anon, authenticated;
create trigger guard_employee_recognition before insert or update on public.employee_evaluations
for each row execute function hris_private.guard_employee_recognition();

notify pgrst, 'reload schema';
commit;
