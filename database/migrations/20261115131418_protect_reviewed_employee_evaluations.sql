begin;

CREATE OR REPLACE FUNCTION public.create_employee_evaluation_template(p_employee_id text, p_period_start date, p_period_end date, p_period_label text DEFAULT NULL::text, p_evaluator_user_id text DEFAULT NULL::text, p_evaluator_name text DEFAULT NULL::text, p_evaluator_role text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_evaluation_id text;
  v_total_weight numeric;
begin
  -- Make sure active criteria weights total 100%
  select coalesce(sum(weight), 0)
  into v_total_weight
  from public.evaluation_criteria
  where is_active = true;

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
  where ec.is_active = true

  on conflict (evaluation_id, criteria_id)
  do update set
    criteria_name = excluded.criteria_name,
    criteria_weight = excluded.criteria_weight,
    max_score = excluded.max_score,
    updated_at = now();

  return v_evaluation_id;
end;
$function$;

commit;
