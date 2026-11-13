begin;

alter table public.payroll_premium_rates
  add column holidays jsonb not null default '[]'::jsonb
  check (jsonb_typeof(holidays) = 'array');

grant update (holidays) on public.payroll_premium_rates to authenticated;

update public.payroll_premium_rates
set nsd_percent = 10,
    regular_holiday_percent = 100,
    special_holiday_percent = 30,
    revision = revision + 1
where id = 1;

alter table public.attendance_logs
  add column work_intervals jsonb
  check (work_intervals is null or jsonb_typeof(work_intervals) = 'array');

create function public.save_generated_payroll(
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

commit;
