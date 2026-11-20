-- Restore the database to the state before the HRIS-score improvement batch
-- and the later automatic request-ID allocator. Existing HR, attendance,
-- payroll, and request records are retained. Feature-only evaluation metadata
-- and position-specific active criteria are rolled back with their schema.
begin;

-- Undo automatic request-ID assignment. Keep existing request_id values and
-- restore the default from the project schema; the pre-batch app may still
-- provide an explicit ID when inserting a request.
drop trigger if exists assign_employee_request_id on public.employee_requests;
drop function if exists hris_private.assign_employee_request_id();
drop table if exists hris_private.request_id_counters;
alter table public.employee_requests alter column request_id
  set default ('REQ-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)));

-- Remove score-batch supervisor, attendance, payroll, directory and report
-- guards, then remove the policies introduced with those guards.
drop trigger if exists guard_supervisor_changes on public.attendance_logs;
drop trigger if exists guard_supervisor_changes on public.employee_requests;
drop trigger if exists guard_supervisor_changes on public.employee_evaluations;
drop trigger if exists guard_cutoff_attendance on public.payroll_summaries;

drop policy if exists "Scope account directory reads" on public.user_accounts;
drop policy if exists "Limit general system logs to management" on public.system_logs;
drop policy if exists "Scope staff and employee reads" on public.employees;
drop policy if exists "Scope staff and employee reads" on public.schedule;
drop policy if exists "Scope staff and employee reads" on public.attendance_logs;
drop policy if exists "Scope staff and employee reads" on public.attendance_summaries;
drop policy if exists "Scope staff and employee reads" on public.employee_requests;
drop policy if exists "Scope staff and employee reads" on public.employee_leave_balances;
drop policy if exists "Scope staff and employee reads" on public.employee_evaluations;
drop policy if exists "Scope staff inserts" on public.employees;
drop policy if exists "Scope staff inserts" on public.schedule;
drop policy if exists "Scope staff inserts" on public.attendance_logs;
drop policy if exists "Scope staff inserts" on public.attendance_summaries;
drop policy if exists "Scope staff inserts" on public.employee_requests;
drop policy if exists "Scope staff inserts" on public.employee_evaluations;
drop policy if exists "Scope staff updates" on public.employees;
drop policy if exists "Scope staff updates" on public.schedule;
drop policy if exists "Scope staff updates" on public.attendance_logs;
drop policy if exists "Scope staff updates" on public.attendance_summaries;
drop policy if exists "Scope staff updates" on public.employee_requests;
drop policy if exists "Scope staff updates" on public.employee_evaluations;
drop policy if exists "Scope staff deletes" on public.employees;
drop policy if exists "Scope staff deletes" on public.schedule;
drop policy if exists "Scope staff deletes" on public.attendance_logs;
drop policy if exists "Scope staff deletes" on public.attendance_summaries;
drop policy if exists "Scope staff deletes" on public.employee_requests;
drop policy if exists "Scope staff deletes" on public.employee_evaluations;
drop policy if exists "Scope score reads to visible evaluations" on public.employee_evaluation_scores;
drop policy if exists "Scope score inserts to evaluation staff" on public.employee_evaluation_scores;
drop policy if exists "Scope score updates to editable evaluations" on public.employee_evaluation_scores;
drop policy if exists "Limit score deletion to HR" on public.employee_evaluation_scores;
drop policy if exists "Limit DSS result access to management" on public.dss_results;
drop policy if exists "Limit DSS result item access to management" on public.dss_result_items;
drop policy if exists "Finance reads forwarded payroll" on public.payroll_summaries;
drop policy if exists "Finance reads forwarded payslips" on public.payroll_items;

drop function if exists public.finance_employee_directory();
drop function if exists public.finance_time_approvals(text, date, date);
drop function if exists hris_private.finance_employee_directory();
drop function if exists hris_private.finance_time_approvals(text, date, date);
drop function if exists hris_private.finance_can_read_payroll(text);
drop function if exists hris_private.guard_supervisor_changes();
drop function if exists hris_private.guard_cutoff_attendance();
drop function if exists hris_private.supervises_employee(text);
drop function if exists hris_private.work_area(text);

-- Undo position-specific evaluation criteria and recognition additions.
drop trigger if exists guard_employee_recognition on public.employee_evaluations;
drop function if exists hris_private.guard_employee_recognition();
drop policy if exists "Restrict criteria reads to evaluation roles" on public.evaluation_criteria;
drop policy if exists "Require HR to create criteria" on public.evaluation_criteria;
drop policy if exists "Require HR to update criteria" on public.evaluation_criteria;
drop policy if exists "Require HR to delete criteria" on public.evaluation_criteria;
drop function if exists public.save_position_evaluation_criteria(text, jsonb);

-- Keep the newly added criteria rows, but deactivate position-specific criteria
-- because the restored application uses one shared criteria set.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'evaluation_criteria'
      and column_name = 'position_key'
  ) then
    update public.evaluation_criteria
    set is_active = false, updated_at = now()
    where coalesce(position_key, '') <> '' and is_active;
  end if;
end
$$;

drop index if exists public.evaluation_criteria_active_name_uidx;
create unique index evaluation_criteria_active_name_uidx
  on public.evaluation_criteria (lower(criteria_name)) where is_active;

alter table public.evaluation_criteria drop column if exists position_key;
alter table public.employee_evaluations drop column if exists recognized_at;
alter table public.employee_evaluations drop column if exists recognition_note;
alter table public.employee_evaluations drop column if exists recognized_by_user_id;

create or replace function public.check_active_evaluation_criteria_weights()
returns table(total_weight numeric, is_ready boolean, message text)
language plpgsql
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(weight), 0) into v_total
  from public.evaluation_criteria where is_active = true;
  return query select v_total, v_total = 100,
    case when v_total = 100 then 'Ready for DSS computation. Active criteria weights total 100%.'
      when v_total < 100 then 'Not ready. Active criteria weights are below 100%.'
      else 'Not ready. Active criteria weights exceed 100%.' end;
end
$$;
revoke all on function public.check_active_evaluation_criteria_weights() from public, anon, authenticated;
grant execute on function public.check_active_evaluation_criteria_weights() to service_role, authenticated;

-- Restore the shared-criteria evaluation template from immediately before the
-- score batch.
create or replace function public.create_employee_evaluation_template(
  p_employee_id text, p_period_start date, p_period_end date,
  p_period_label text default null::text, p_evaluator_user_id text default null::text,
  p_evaluator_name text default null::text, p_evaluator_role text default null::text
) returns text language plpgsql as $$
declare
  v_evaluation_id text;
  v_total_weight numeric;
begin
  select coalesce(sum(weight), 0) into v_total_weight
  from public.evaluation_criteria where is_active = true;
  if v_total_weight <> 100 then
    raise exception 'Cannot create evaluation. Active criteria weights total %, not 100.', v_total_weight;
  end if;

  insert into public.employee_evaluations (
    employee_id, employee_name, position, outlet, evaluation_period_start,
    evaluation_period_end, evaluation_period_label, evaluator_user_id,
    evaluator_name, evaluator_role, status
  )
  select e.employee_id, concat_ws(' ', e.first_name, e.middle_name, e.last_name, e.suffix),
    e.position, e.outlet, p_period_start, p_period_end, p_period_label,
    p_evaluator_user_id, p_evaluator_name, p_evaluator_role, 'Draft'
  from public.employees e where e.employee_id = p_employee_id
  on conflict (employee_id, evaluation_period_start, evaluation_period_end)
  do update set employee_name = excluded.employee_name,
    position = excluded.position, outlet = excluded.outlet,
    evaluation_period_label = excluded.evaluation_period_label,
    evaluator_user_id = excluded.evaluator_user_id, evaluator_name = excluded.evaluator_name,
    evaluator_role = excluded.evaluator_role, updated_at = now()
  where employee_evaluations.status in ('Draft', 'Returned')
  returning evaluation_id into v_evaluation_id;

  if v_evaluation_id is null then
    raise exception 'A submitted or approved evaluation already exists for this employee and period. Choose a different period.';
  end if;

  insert into public.employee_evaluation_scores (
    evaluation_id, criteria_id, criteria_name, criteria_weight, max_score, raw_score, weighted_score
  )
  select v_evaluation_id, ec.criteria_id, ec.criteria_name, ec.weight, ec.max_score, 0, 0
  from public.evaluation_criteria ec where ec.is_active = true
  on conflict (evaluation_id, criteria_id)
  do update set criteria_name = excluded.criteria_name,
    criteria_weight = excluded.criteria_weight, max_score = excluded.max_score, updated_at = now();
  return v_evaluation_id;
end
$$;

-- Restore the pre-score payroll-save routine.
create or replace function public.save_generated_payroll(
  p_summary jsonb, p_items jsonb, p_replace_draft boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  summary public.payroll_summaries := jsonb_populate_record(null::public.payroll_summaries, p_summary);
begin
  if not coalesce(public.hris_has_role(array['hr_admin', 'general_manager']), false) then
    raise exception 'Payroll generation requires HR or General Manager access' using errcode = '42501';
  end if;
  if p_replace_draft then
    perform 1 from public.payroll_summaries
    where payroll_id = summary.payroll_id and status = 'Draft'
      and period_start = summary.period_start and period_end = summary.period_end for update;
    if not found then raise exception 'The existing payroll is no longer a draft. Refresh and try again.'; end if;
    if exists (select 1 from public.payroll_items where payroll_id = summary.payroll_id and remarks = 'Manual payroll entry') then
      raise exception 'This cutoff contains manual drafts. Review those payslips before regenerating payroll.';
    end if;
    delete from public.payroll_summaries
    where payroll_id = summary.payroll_id and status = 'Draft'
      and period_start = summary.period_start and period_end = summary.period_end;
    if not found then raise exception 'The existing payroll is no longer a draft. Refresh and try again.'; end if;
  end if;

  insert into public.payroll_summaries (
    payroll_id, period_start, period_end, cutoff_label, status, prepared_by_user_id,
    total_employees, total_regular_hours, total_overtime_hours, total_late_minutes,
    total_undertime_minutes, total_gross_pay, total_deductions, total_overtime_pay,
    total_net_pay, endorsed_to, remarks
  ) values (
    summary.payroll_id, summary.period_start, summary.period_end, summary.cutoff_label, 'Draft',
    summary.prepared_by_user_id, summary.total_employees, summary.total_regular_hours,
    summary.total_overtime_hours, summary.total_late_minutes, summary.total_undertime_minutes,
    summary.total_gross_pay, summary.total_deductions, summary.total_overtime_pay,
    summary.total_net_pay, summary.endorsed_to, summary.remarks
  );

  insert into public.payroll_items (
    payroll_id, attendance_summary_id, employee_id, employee_name, position, outlet,
    salary_rate, rate_type, total_work_hours, regular_hours, overtime_hours, total_late_minutes,
    total_undertime_minutes, total_absent_days, total_incomplete_days, basic_pay, overtime_pay,
    late_deduction, undertime_deduction, absence_deduction, other_deductions,
    gross_pay, total_deductions, net_pay, payslip_details, remarks
  )
  select summary.payroll_id, item.attendance_summary_id, item.employee_id, item.employee_name,
    item.position, item.outlet, item.salary_rate, item.rate_type, item.total_work_hours,
    item.regular_hours, item.overtime_hours, item.total_late_minutes, item.total_undertime_minutes,
    item.total_absent_days, item.total_incomplete_days, item.basic_pay, item.overtime_pay,
    item.late_deduction, item.undertime_deduction, item.absence_deduction, item.other_deductions,
    item.gross_pay, item.total_deductions, item.net_pay, item.payslip_details, item.remarks
  from jsonb_populate_recordset(null::public.payroll_items, p_items) as item;
end
$$;
revoke all on function public.save_generated_payroll(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_generated_payroll(jsonb, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
