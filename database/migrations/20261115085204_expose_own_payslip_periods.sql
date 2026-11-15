begin;

create function hris_private.own_payslip_periods()
returns table (
  payroll_id text, period_start date, period_end date, status text,
  endorsed_at timestamptz, reviewed_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select summary.payroll_id, summary.period_start, summary.period_end, summary.status,
    summary.endorsed_at, summary.reviewed_at, summary.created_at
  from public.payroll_summaries summary
  where summary.status in ('Endorsed','Exported') and exists (
    select 1 from public.payroll_items item
    where item.payroll_id = summary.payroll_id and hris_private.is_own_employee(item.employee_id)
  )
  order by summary.period_start desc;
$$;

create function public.own_payslip_periods()
returns table (
  payroll_id text, period_start date, period_end date, status text,
  endorsed_at timestamptz, reviewed_at timestamptz, created_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select * from hris_private.own_payslip_periods();
$$;

revoke all on function hris_private.own_payslip_periods() from public, anon, authenticated;
revoke all on function public.own_payslip_periods() from public, anon, authenticated;
grant execute on function hris_private.own_payslip_periods() to authenticated;
grant execute on function public.own_payslip_periods() to authenticated;

commit;
