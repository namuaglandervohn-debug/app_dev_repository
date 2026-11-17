-- Reverts the database objects introduced by the HRIS-score improvement batch.
-- The certificate/document workflow was intentionally not part of that batch
-- and is therefore unaffected by this rollback.
begin;

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

-- Restore the payroll-save procedure that existed immediately before the
-- score-improvement batch. In particular, payroll generation no longer adds
-- the batch's attendance-validation gate.
create or replace function public.save_generated_payroll(
  p_summary jsonb, p_items jsonb, p_replace_draft boolean
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
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
$$;

revoke all on function public.save_generated_payroll(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_generated_payroll(jsonb, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
