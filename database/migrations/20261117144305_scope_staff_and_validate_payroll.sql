begin;

create function hris_private.work_area(value text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(btrim(coalesce(value,'')), 'Éé', 'Ee')), '[[:space:]]+', ' ', 'g')
$$;

create function hris_private.supervises_employee(target text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_accounts supervisor
    join public.employees employee on employee.employee_id = target
    left join public.employees linked on linked.employee_id = supervisor.employee_id
    where (select auth.uid()) is not null
      and (supervisor.auth_user_id = (select auth.uid()) or
        (supervisor.auth_user_id is null and lower(supervisor.email) = lower((select auth.jwt())->>'email')))
      and supervisor.is_active and supervisor.role = 'supervisor'
      and (
        (hris_private.work_area(coalesce(nullif(trim(supervisor.outlet),''), linked.outlet)) not in ('','no outlet','__no_outlet__')
          and hris_private.work_area(coalesce(nullif(trim(supervisor.outlet),''), linked.outlet)) = hris_private.work_area(employee.outlet))
        or (hris_private.work_area(linked.department) <> ''
          and hris_private.work_area(linked.department) = hris_private.work_area(employee.department))
      )
  )
$$;
revoke all on function hris_private.supervises_employee(text) from public, anon;
grant execute on function hris_private.supervises_employee(text) to authenticated;

create policy "Scope account directory reads" on public.user_accounts as restrictive for select to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager']))
  or auth_user_id = (select auth.uid())
  or (auth_user_id is null and lower(email) = lower((select auth.jwt())->>'email'))
  or hris_private.supervises_employee(employee_id));

create policy "Limit general system logs to management" on public.system_logs as restrictive for select to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager'])));

do $$
declare
  table_name text;
  managers text := '(select public.hris_has_role(array[''hr_admin'',''general_manager'']))';
  finance text := '(select public.hris_has_role(array[''accounting_finance'']))';
  allowed text;
begin
  foreach table_name in array array['employees','schedule','attendance_logs','attendance_summaries','employee_requests','employee_leave_balances','employee_evaluations'] loop
    allowed := managers || ' or hris_private.supervises_employee(employee_id) or hris_private.is_own_employee(employee_id)';
    if table_name in ('schedule','attendance_logs','attendance_summaries') then allowed := allowed || ' or ' || finance; end if;
    if table_name = 'employee_evaluations' then
      allowed := managers || ' or hris_private.supervises_employee(employee_id) or (hris_private.is_own_employee(employee_id) and status in (''Submitted'',''Reviewed'',''Approved''))';
    end if;
    execute format('create policy "Scope staff and employee reads" on public.%I as restrictive for select to authenticated using (%s)', table_name, allowed);
  end loop;

  foreach table_name in array array['employees','schedule','attendance_logs','attendance_summaries','employee_requests','employee_evaluations'] loop
    allowed := case
      when table_name = 'employees' then managers
      when table_name in ('schedule','employee_evaluations') then managers || ' or hris_private.supervises_employee(employee_id)'
      when table_name = 'employee_requests' then managers || ' or hris_private.is_own_employee(employee_id)'
      else managers end;
    execute format('create policy "Scope staff inserts" on public.%I as restrictive for insert to authenticated with check (%s)', table_name, allowed);
    allowed := case
      when table_name in ('schedule','attendance_logs','employee_requests','employee_evaluations') then managers || ' or hris_private.supervises_employee(employee_id)'
      else managers end;
    if table_name in ('employees','schedule','employee_requests') then allowed := allowed || ' or hris_private.is_own_employee(employee_id)'; end if;
    execute format('create policy "Scope staff updates" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', table_name, allowed, allowed);
    allowed := case when table_name = 'schedule' then managers || ' or hris_private.supervises_employee(employee_id)' else managers end;
    execute format('create policy "Scope staff deletes" on public.%I as restrictive for delete to authenticated using (%s)', table_name, allowed);
  end loop;
end
$$;

create policy "Scope score reads to visible evaluations" on public.employee_evaluation_scores as restrictive for select to authenticated
using (exists (select 1 from public.employee_evaluations assessment
  where assessment.evaluation_id = employee_evaluation_scores.evaluation_id));
create policy "Scope score inserts to evaluation staff" on public.employee_evaluation_scores as restrictive for insert to authenticated
with check ((select public.hris_has_role(array['hr_admin','general_manager','supervisor'])) and exists (
  select 1 from public.employee_evaluations assessment where assessment.evaluation_id = employee_evaluation_scores.evaluation_id and assessment.status in ('Draft','Returned')));
create policy "Scope score updates to editable evaluations" on public.employee_evaluation_scores as restrictive for update to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager','supervisor'])) and exists (
  select 1 from public.employee_evaluations assessment where assessment.evaluation_id = employee_evaluation_scores.evaluation_id and assessment.status in ('Draft','Returned')))
with check ((select public.hris_has_role(array['hr_admin','general_manager','supervisor'])) and exists (
  select 1 from public.employee_evaluations assessment where assessment.evaluation_id = employee_evaluation_scores.evaluation_id and assessment.status in ('Draft','Returned')));
create policy "Limit score deletion to HR" on public.employee_evaluation_scores as restrictive for delete to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager'])));

create policy "Limit DSS result access to management" on public.dss_results as restrictive for all to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager'])))
with check ((select public.hris_has_role(array['hr_admin','general_manager'])));
create policy "Limit DSS result item access to management" on public.dss_result_items as restrictive for all to authenticated
using ((select public.hris_has_role(array['hr_admin','general_manager'])))
with check ((select public.hris_has_role(array['hr_admin','general_manager'])));

create function hris_private.finance_employee_directory()
returns table(employee_id text, employee_name text, outlet text)
language sql stable security definer set search_path = '' as $$
  select e.employee_id, concat_ws(' ',e.first_name,e.middle_name,e.last_name,e.suffix), e.outlet
  from public.employees e
  where (select auth.uid()) is not null and (select public.hris_has_role(array['accounting_finance']))
$$;
create function public.finance_employee_directory()
returns table(employee_id text, employee_name text, outlet text)
language sql stable security invoker set search_path = '' as $$
  select * from hris_private.finance_employee_directory()
$$;
revoke all on function hris_private.finance_employee_directory(), public.finance_employee_directory() from public, anon;
grant execute on function hris_private.finance_employee_directory(), public.finance_employee_directory() to authenticated;

create function hris_private.finance_time_approvals(p_employee_id text, p_start date, p_end date)
returns table(employee_id text, request_type text, start_date date, end_date date, start_time time, end_time time)
language sql stable security definer set search_path = '' as $$
  select r.employee_id,r.request_type,r.start_date,r.end_date,r.start_time,r.end_time
  from public.employee_requests r
  where (select auth.uid()) is not null and (select public.hris_has_role(array['accounting_finance']))
    and p_start <= p_end and p_end - p_start <= 62
    and (p_employee_id is null or r.employee_id = p_employee_id)
    and r.start_date <= p_end and r.end_date >= p_start
    and r.status = 'Approved' and r.hr_status = 'Approved' and r.request_type in ('Overtime','Undertime','Leave')
$$;
create function public.finance_time_approvals(p_employee_id text, p_start date, p_end date)
returns table(employee_id text, request_type text, start_date date, end_date date, start_time time, end_time time)
language sql stable security invoker set search_path = '' as $$
  select * from hris_private.finance_time_approvals(p_employee_id,p_start,p_end)
$$;
revoke all on function hris_private.finance_time_approvals(text,date,date), public.finance_time_approvals(text,date,date) from public, anon;
grant execute on function hris_private.finance_time_approvals(text,date,date), public.finance_time_approvals(text,date,date) to authenticated;

create function hris_private.finance_can_read_payroll(target text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (select public.hris_has_role(array['accounting_finance']))
    and exists (select 1 from public.payroll_summaries summary
      where summary.payroll_id = target and summary.status <> 'Draft')
$$;
revoke all on function hris_private.finance_can_read_payroll(text) from public, anon;
grant execute on function hris_private.finance_can_read_payroll(text) to authenticated;
create policy "Finance reads forwarded payroll" on public.payroll_summaries as restrictive for select to authenticated
using (not (select public.hris_has_role(array['accounting_finance'])) or status <> 'Draft');
create policy "Finance reads forwarded payslips" on public.payroll_items as restrictive for select to authenticated
using (not (select public.hris_has_role(array['accounting_finance'])) or hris_private.finance_can_read_payroll(payroll_id));

create function hris_private.guard_supervisor_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not (select public.hris_has_role(array['supervisor'])) then return new; end if;
  if tg_table_name = 'attendance_logs' then
    if new.validation_status <> 'Validated' or (to_jsonb(new) - array['validation_status','reviewed_at','reviewed_by_name','updated_at'])
       <> (to_jsonb(old) - array['validation_status','reviewed_at','reviewed_by_name','updated_at']) then
      raise exception 'Supervisors can only validate attendance for assigned employees.' using errcode='42501';
    end if;
  elsif tg_table_name = 'employee_requests' then
    if old.status <> 'Pending' or new.status not in ('Supervisor Approved','Disapproved') or
      (to_jsonb(new) - array['status','supervisor_status','supervisor_note','supervisor_user_id','supervisor_name','supervisor_reviewed_at','reviewed_by_user_id','reviewed_at','reviewer_remarks','updated_at'])
      <> (to_jsonb(old) - array['status','supervisor_status','supervisor_note','supervisor_user_id','supervisor_name','supervisor_reviewed_at','reviewed_by_user_id','reviewed_at','reviewer_remarks','updated_at']) then
      raise exception 'Supervisors can only review pending requests for assigned employees.' using errcode='42501';
    end if;
  elsif tg_table_name = 'employee_evaluations' then
    if new.status not in ('Draft','Returned','Submitted') then
      raise exception 'Supervisors can submit evaluations for management review.' using errcode='42501';
    end if;
    if tg_op='UPDATE' and (old.status not in ('Draft','Returned') or new.employee_id <> old.employee_id) then
      raise exception 'This evaluation can no longer be edited by a supervisor.' using errcode='42501';
    end if;
  end if;
  return new;
end
$$;
revoke all on function hris_private.guard_supervisor_changes() from public, anon, authenticated;
create trigger guard_supervisor_changes before update on public.attendance_logs for each row execute function hris_private.guard_supervisor_changes();
create trigger guard_supervisor_changes before update on public.employee_requests for each row execute function hris_private.guard_supervisor_changes();
create trigger guard_supervisor_changes before insert or update on public.employee_evaluations for each row execute function hris_private.guard_supervisor_changes();

CREATE OR REPLACE FUNCTION public.save_generated_payroll(p_summary jsonb, p_items jsonb, p_replace_draft boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  summary public.payroll_summaries := jsonb_populate_record(null::public.payroll_summaries, p_summary);
begin
  if not coalesce(public.hris_has_role(array['hr_admin', 'general_manager']), false) then
    raise exception 'Payroll generation requires HR or General Manager access' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.attendance_logs log
    join jsonb_populate_recordset(null::public.payroll_items, p_items) item on item.employee_id = log.employee_id
    where log.attendance_date between summary.period_start and summary.period_end
      and log.validation_status <> 'Validated'
  ) then
    raise exception 'Review unvalidated attendance for this cutoff before generating payroll.';
  end if;

  if p_replace_draft then
    perform 1 from public.payroll_summaries
    where payroll_id = summary.payroll_id and status = 'Draft'
      and period_start = summary.period_start and period_end = summary.period_end for update;
    if not found then
      raise exception 'The existing payroll is no longer a draft. Refresh and try again.';
    end if;
    if exists (select 1 from public.payroll_items
      where payroll_id = summary.payroll_id and remarks = 'Manual payroll entry') then
      raise exception 'This cutoff contains manual drafts. Review those payslips before regenerating payroll.';
    end if;
    delete from public.payroll_summaries
    where payroll_id = summary.payroll_id and status = 'Draft'
      and period_start = summary.period_start and period_end = summary.period_end;
    if not found then
      raise exception 'The existing payroll is no longer a draft. Refresh and try again.';
    end if;
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
end;
$function$
;

create function hris_private.guard_cutoff_attendance()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'Draft' and old.status <> 'Draft'
      and (old.status not in ('Reviewed','Approved') or not (select public.hris_has_role(array['hr_admin','general_manager']))) then
    raise exception 'Only HR or the General Manager can return unreleased payroll to Draft.' using errcode='42501';
  end if;
  if new.status in ('Reviewed','Approved','Endorsed','Exported') and old.status is distinct from new.status and exists (
    select 1 from public.payroll_items item
    join public.attendance_logs log on log.employee_id = item.employee_id
    where item.payroll_id = new.payroll_id and item.attendance_summary_id is not null
      and log.attendance_date between new.period_start and new.period_end and log.validation_status <> 'Validated'
  ) then
    raise exception 'Resolve unvalidated attendance before forwarding or releasing this cutoff.';
  end if;
  return new;
end
$$;
revoke all on function hris_private.guard_cutoff_attendance() from public, anon, authenticated;
create trigger guard_cutoff_attendance before update of status on public.payroll_summaries
for each row execute function hris_private.guard_cutoff_attendance();

notify pgrst, 'reload schema';
commit;
