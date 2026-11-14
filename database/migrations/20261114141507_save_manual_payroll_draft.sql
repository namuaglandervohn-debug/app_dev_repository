create function public.save_manual_payroll_draft(p_start date, p_end date, p_cutoff text, p_prepared_by text, p_item jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  item public.payroll_items := jsonb_populate_record(null::public.payroll_items, p_item);
  summary public.payroll_summaries%rowtype;
begin
  if not coalesce(public.hris_has_role(array['hr_admin', 'general_manager']), false) then
    raise exception 'Only HR or the General Manager can save manual payroll.' using errcode = '42501';
  end if;
  insert into public.payroll_summaries (period_start, period_end, cutoff_label, status, prepared_by_user_id)
  values (p_start, p_end, p_cutoff, 'Draft', p_prepared_by)
  on conflict (period_start, period_end) do nothing;

  select * into strict summary from public.payroll_summaries
  where period_start = p_start and period_end = p_end for update;
  if summary.status <> 'Draft' then
    raise exception 'This cutoff is no longer a draft.';
  end if;
  if exists (select 1 from public.payroll_items where payroll_id = summary.payroll_id and employee_id = item.employee_id) then
    raise exception 'A payroll record already exists for this employee in this cutoff. Open its payslip to make changes.';
  end if;

  insert into public.payroll_items (
    payroll_id, employee_id, employee_name, position, outlet, salary_rate, rate_type,
    total_work_hours, regular_hours, overtime_hours, basic_pay, overtime_pay, other_deductions,
    gross_pay, total_deductions, net_pay, payslip_details, remarks
  ) values (
    summary.payroll_id, item.employee_id, item.employee_name, item.position, item.outlet, item.salary_rate, 'Daily',
    item.total_work_hours, item.regular_hours, item.overtime_hours, item.basic_pay, item.overtime_pay, item.other_deductions,
    item.gross_pay, item.total_deductions, item.net_pay, item.payslip_details, 'Manual payroll entry'
  );

  update public.payroll_summaries set
    (total_employees, total_regular_hours, total_overtime_hours, total_overtime_pay,
      total_gross_pay, total_deductions, total_net_pay) = (
      select count(*), sum(regular_hours), sum(overtime_hours), sum(overtime_pay),
        sum(gross_pay), sum(total_deductions), sum(net_pay)
      from public.payroll_items where payroll_id = summary.payroll_id
    )
  where payroll_id = summary.payroll_id;
end;
$$;

revoke all on function public.save_manual_payroll_draft(date,date,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.save_manual_payroll_draft(date,date,text,text,jsonb) to authenticated;

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
