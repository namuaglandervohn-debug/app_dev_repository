begin;

-- Synthetic data used only by the HR Analytics charts. It never enters the
-- operational attendance, payroll, request, evaluation, applicant, or employee
-- tables. Re-running the seed section replaces only this version's demo rows.
create table if not exists public.hr_analytics_demo_records (
  seed_key text primary key,
  record_type text not null check (record_type in ('employee_outlet', 'attendance', 'performance', 'leave_request', 'recruitment')),
  employee_id text,
  outlet text not null,
  record_date date not null,
  status text,
  score numeric(5,2),
  is_late boolean not null default false,
  is_absent boolean not null default false,
  late_minutes integer not null default 0 check (late_minutes >= 0),
  request_type text,
  created_at timestamptz not null default now(),
  constraint hr_analytics_demo_score_range check (score is null or score between 0 and 100)
);

create index if not exists hr_analytics_demo_type_date_idx
  on public.hr_analytics_demo_records(record_type, record_date);
create index if not exists hr_analytics_demo_employee_idx
  on public.hr_analytics_demo_records(employee_id);

alter table public.hr_analytics_demo_records enable row level security;
revoke all on public.hr_analytics_demo_records from public, anon, authenticated;
drop policy if exists "Authorized staff read HR analytics demo data" on public.hr_analytics_demo_records;
create policy "Authorized staff read HR analytics demo data" on public.hr_analytics_demo_records
  for select to authenticated
  using (public.hris_has_role(array['hr_admin', 'general_manager', 'accounting_finance', 'supervisor']));
grant select on public.hr_analytics_demo_records to authenticated;

delete from public.hr_analytics_demo_records
where seed_key like 'hr-analytics-demo-v1:%';

-- Give the existing employees an analytics-only sample outlet allocation.
-- The official employee outlet assignments remain untouched.
with ranked_employees as (
  select employee_id,
         row_number() over (order by employee_id)::integer as employee_rank
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
), selected_employees as (
  select employee_id, employee_rank,
         case
           when employee_rank <= 5 then 'Maria Clara Restaurant'
           when employee_rank <= 10 then 'Maria Clara Resort'
           else 'Buenaventura Café'
         end as outlet
  from ranked_employees
  where employee_rank <= 14
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status)
select 'hr-analytics-demo-v1:employee-outlet:' || employee_id,
       'employee_outlet', employee_id, outlet, current_date, 'Active'
from selected_employees
on conflict (seed_key) do update set
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status;

-- Seed 18 months so every month offered by the dashboard has sample activity.
with ranked_employees as (
  select employee_id,
         row_number() over (order by employee_id)::integer as employee_rank,
         case
           when row_number() over (order by employee_id) <= 5 then 'Maria Clara Restaurant'
           when row_number() over (order by employee_id) <= 10 then 'Maria Clara Resort'
           else 'Buenaventura Café'
         end as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
), employees_sample as (
  select employee_id, employee_rank, outlet
  from ranked_employees
  where employee_rank <= 14
), months as (
  select month_back,
         (date_trunc('month', current_date)::date - (month_back || ' months')::interval)::date as month_start
  from generate_series(0, 17) as month_series(month_back)
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status, is_late, is_absent, late_minutes)
select 'hr-analytics-demo-v1:attendance:' || e.employee_id || ':' || to_char(d.record_date, 'YYYYMMDD'),
       'attendance', e.employee_id, e.outlet, d.record_date,
       case when (e.employee_rank + d.day_number + m.month_back) % 17 = 0 then 'Absent'
            when (e.employee_rank + d.day_number + m.month_back) % 4 = 0 then 'Late'
            else 'Present' end,
       (e.employee_rank + d.day_number + m.month_back) % 17 <> 0
         and (e.employee_rank + d.day_number + m.month_back) % 4 = 0,
       (e.employee_rank + d.day_number + m.month_back) % 17 = 0,
       case when (e.employee_rank + d.day_number + m.month_back) % 17 = 0 then 0
            when (e.employee_rank + d.day_number + m.month_back) % 4 = 0 then 5 + ((e.employee_rank * 3 + d.day_number) % 36)
            else 0 end
from employees_sample e
cross join months m
cross join generate_series(0, 11) as day_series(day_number)
cross join lateral (
  select day_series.day_number,
         m.month_start + (day_series.day_number * 2) as record_date
) as d
where d.record_date < (m.month_start + interval '1 month')::date
  and extract(isodow from d.record_date) between 1 and 5
on conflict (seed_key) do update set
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status,
  is_late = excluded.is_late,
  is_absent = excluded.is_absent,
  late_minutes = excluded.late_minutes;

with ranked_employees as (
  select employee_id,
         row_number() over (order by employee_id)::integer as employee_rank,
         case
           when row_number() over (order by employee_id) <= 5 then 'Maria Clara Restaurant'
           when row_number() over (order by employee_id) <= 10 then 'Maria Clara Resort'
           else 'Buenaventura Café'
         end as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
), employees_sample as (
  select employee_id, employee_rank, outlet from ranked_employees where employee_rank <= 14
), months as (
  select month_back,
         (date_trunc('month', current_date)::date - (month_back || ' months')::interval)::date as month_start
  from generate_series(0, 17) as month_series(month_back)
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status, score)
select 'hr-analytics-demo-v1:performance:' || e.employee_id || ':' || to_char(m.month_start, 'YYYYMM'),
       'performance', e.employee_id, e.outlet, m.month_start + 14, 'Approved',
       74 + ((e.employee_rank * 7 + m.month_back * 3) % 26)
from employees_sample e cross join months m
on conflict (seed_key) do update set
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status,
  score = excluded.score;

with ranked_employees as (
  select employee_id,
         row_number() over (order by employee_id)::integer as employee_rank,
         case
           when row_number() over (order by employee_id) <= 5 then 'Maria Clara Restaurant'
           when row_number() over (order by employee_id) <= 10 then 'Maria Clara Resort'
           else 'Buenaventura Café'
         end as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
), employees_sample as (
  select employee_id, employee_rank, outlet from ranked_employees where employee_rank <= 14
), months as (
  select month_back,
         (date_trunc('month', current_date)::date - (month_back || ' months')::interval)::date as month_start
  from generate_series(0, 17) as month_series(month_back)
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status, request_type)
select 'hr-analytics-demo-v1:leave:' || e.employee_id || ':' || to_char(m.month_start, 'YYYYMM'),
       'leave_request', e.employee_id, e.outlet, m.month_start + 7,
       case (e.employee_rank + m.month_back) % 3
         when 0 then 'Approved' when 1 then 'Pending' else 'Rejected' end,
       'Leave'
from employees_sample e cross join months m
where (e.employee_rank + m.month_back) % 4 <> 0
on conflict (seed_key) do update set
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status,
  request_type = excluded.request_type;

-- Applicant outcomes are anonymous synthetic events, distributed over the
-- same outlets so the recruitment chart also responds to outlet/month filters.
with ranked_employees as (
  select row_number() over (order by employee_id)::integer as sample_rank,
         case
           when row_number() over (order by employee_id) <= 5 then 'Maria Clara Restaurant'
           when row_number() over (order by employee_id) <= 10 then 'Maria Clara Resort'
           else 'Buenaventura Café'
         end as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
), employees_sample as (
  select sample_rank, outlet from ranked_employees where sample_rank <= 14
), months as (
  select month_back,
         (date_trunc('month', current_date)::date - (month_back || ' months')::interval)::date as month_start
  from generate_series(0, 17) as month_series(month_back)
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, outlet, record_date, status)
select 'hr-analytics-demo-v1:recruitment:' || to_char(m.month_start, 'YYYYMM') || ':' || lpad(e.sample_rank::text, 2, '0'),
       'recruitment', e.outlet, m.month_start + ((e.sample_rank * 2) % 26),
       case e.sample_rank % 5
         when 0 then 'For interview'
         when 1 then 'Hired'
         when 2 then 'Rejected'
         when 3 then 'Withdrawn'
         else 'Pending review' end
from employees_sample e cross join months m
on conflict (seed_key) do update set
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status;

-- Real-time analytics refreshes when an operational or demo source changes.
do $$
declare
  table_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array[
      'employees', 'attendance_logs', 'employee_evaluations', 'employee_requests',
      'applicants', 'user_accounts', 'hr_analytics_demo_records'
    ] loop
      if to_regclass('public.' || table_name) is not null
        and not exists (
          select 1 from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = table_name
        ) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;

-- To remove only this migration's sample rows later:
-- delete from public.hr_analytics_demo_records where seed_key like 'hr-analytics-demo-v1:%';
