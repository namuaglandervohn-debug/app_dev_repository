begin;
create table if not exists public.employee_leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.employees(employee_id) on delete cascade,
  leave_type text not null,
  available numeric(10,3) not null default 0 check(available >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id,leave_type)
);
create index if not exists employee_leave_balances_employee_id_idx on public.employee_leave_balances(employee_id);
insert into public.employee_leave_balances(employee_id,leave_type,available)
select employee_id,'Company Paid Leave',5 from public.employees on conflict(employee_id,leave_type) do nothing;
alter table public.employee_leave_balances enable row level security;
drop policy if exists "Internal account access" on public.employee_leave_balances;
drop policy if exists "Require internal account" on public.employee_leave_balances;
drop policy if exists "Staff read leave balances" on public.employee_leave_balances;
create policy "Staff read leave balances" on public.employee_leave_balances for select to authenticated
using(public.hris_has_role(array['hr_admin','general_manager','accounting_finance','supervisor']));
drop policy if exists "Employees read own leave balance" on public.employee_leave_balances;
create policy "Employees read own leave balance" on public.employee_leave_balances for select to authenticated
using(exists(select 1 from public.user_accounts a where a.employee_id=employee_leave_balances.employee_id and a.auth_user_id=auth.uid() and a.is_active=true));
drop policy if exists "HR manages leave balances" on public.employee_leave_balances;
create policy "HR manages leave balances" on public.employee_leave_balances for all to authenticated
using(public.hris_has_role(array['hr_admin'])) with check(public.hris_has_role(array['hr_admin']));
grant select,insert,update,delete on public.employee_leave_balances to authenticated;
commit;
