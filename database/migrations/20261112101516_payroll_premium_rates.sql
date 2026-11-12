begin;

create table public.payroll_premium_rates (
  id smallint primary key default 1 check (id = 1),
  revision integer not null default 0 check (revision >= 0),
  nsd_percent numeric check (nsd_percent >= 0 and nsd_percent < 'Infinity'::numeric),
  regular_holiday_percent numeric check (regular_holiday_percent >= 0 and regular_holiday_percent < 'Infinity'::numeric),
  special_holiday_percent numeric check (special_holiday_percent >= 0 and special_holiday_percent < 'Infinity'::numeric),
  sil_percent numeric check (sil_percent >= 0 and sil_percent < 'Infinity'::numeric)
);

insert into public.payroll_premium_rates default values;

alter table public.payroll_premium_rates enable row level security;
revoke all on table public.payroll_premium_rates from public, anon, authenticated;
grant select on table public.payroll_premium_rates to authenticated;
grant update (revision, nsd_percent, regular_holiday_percent, special_holiday_percent, sil_percent)
  on public.payroll_premium_rates to authenticated;

create policy "Payroll staff read premium rates"
  on public.payroll_premium_rates for select to authenticated
  using ((select public.hris_has_role(array['hr_admin', 'accounting_finance', 'general_manager'])));

create policy "HR updates premium rates"
  on public.payroll_premium_rates for update to authenticated
  using ((select public.hris_has_role(array['hr_admin'])))
  with check ((select public.hris_has_role(array['hr_admin'])));

commit;
