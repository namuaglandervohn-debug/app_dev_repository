begin;

-- Fill the HR Analytics charts with repeatable, analytics-only monthly samples.
-- These rows are read by the dashboard but never written into operational tables.
-- Hired recruitment outcomes are linked to a real employee ID so the hire chart
-- can group them by outlet without changing the employee's official hire date.
with months as (
  select month_start::date
  from generate_series(
    date '1990-01-01',
    (date_trunc('year', current_date) + interval '11 months')::date,
    interval '1 month'
  ) as month_series(month_start)
), outlets as (
  select distinct btrim(outlet) as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
    and nullif(btrim(outlet), '') is not null
), slots as (
  select month_start, outlet, sample_number
  from months cross join outlets cross join generate_series(1, 3) as sample(sample_number)
), samples as (
  select s.month_start, s.outlet, s.sample_number,
         'hr-analytics-demo-v2:performance:' || to_char(s.month_start, 'YYYYMM') || ':' ||
           regexp_replace(lower(s.outlet), '[^a-z0-9]+', '-', 'g') || ':' || s.sample_number as seed_key,
         employee.employee_id,
         1 + mod(abs(hashtext(s.outlet || s.month_start::text || ':performance:' || s.sample_number)::bigint), 28)::integer as day_offset,
         65 + mod(abs(hashtext(s.outlet || s.month_start::text || ':score:' || s.sample_number)::bigint), 36)::integer as score
  from slots s
  cross join lateral (
    select e.employee_id
    from public.employees e
    where lower(btrim(coalesce(e.status, ''))) = 'active'
      and btrim(e.outlet) = s.outlet
    order by md5(e.employee_id || s.month_start::text || s.sample_number::text)
    limit 1
  ) employee
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status, score)
select seed_key, 'performance', employee_id, outlet,
       month_start + (day_offset - 1), 'Approved', score
from samples
on conflict (seed_key) do update set
  employee_id = excluded.employee_id,
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status,
  score = excluded.score;

with months as (
  select month_start::date
  from generate_series(
    date '1990-01-01',
    (date_trunc('year', current_date) + interval '11 months')::date,
    interval '1 month'
  ) as month_series(month_start)
), outlets as (
  select distinct btrim(outlet) as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
    and nullif(btrim(outlet), '') is not null
), slots as (
  select month_start, outlet, sample_number
  from months cross join outlets cross join generate_series(1, 4) as sample(sample_number)
), samples as (
  select s.month_start, s.outlet, s.sample_number,
         'hr-analytics-demo-v2:leave:' || to_char(s.month_start, 'YYYYMM') || ':' ||
           regexp_replace(lower(s.outlet), '[^a-z0-9]+', '-', 'g') || ':' || s.sample_number as seed_key,
         employee.employee_id,
         1 + mod(abs(hashtext(s.outlet || s.month_start::text || ':leave:' || s.sample_number)::bigint), 28)::integer as day_offset,
         case mod(abs(hashtext(s.outlet || s.month_start::text || ':leave-status:' || s.sample_number)::bigint), 3)
           when 0 then 'Approved' when 1 then 'Pending' else 'Rejected' end as request_status
  from slots s
  cross join lateral (
    select e.employee_id
    from public.employees e
    where lower(btrim(coalesce(e.status, ''))) = 'active'
      and btrim(e.outlet) = s.outlet
    order by md5(e.employee_id || s.month_start::text || s.sample_number::text)
    limit 1
  ) employee
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status, request_type)
select seed_key, 'leave_request', employee_id, outlet,
       month_start + (day_offset - 1), request_status, 'Leave'
from samples
on conflict (seed_key) do update set
  employee_id = excluded.employee_id,
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status,
  request_type = excluded.request_type;

with months as (
  select month_start::date
  from generate_series(
    date '1990-01-01',
    (date_trunc('year', current_date) + interval '11 months')::date,
    interval '1 month'
  ) as month_series(month_start)
), outlets as (
  select distinct btrim(outlet) as outlet
  from public.employees
  where lower(btrim(coalesce(status, ''))) = 'active'
    and nullif(btrim(outlet), '') is not null
), slots as (
  select month_start, outlet, sample_number
  from months cross join outlets cross join generate_series(1, 6) as sample(sample_number)
), samples as (
  select s.month_start, s.outlet, s.sample_number,
         'hr-analytics-demo-v2:recruitment:' || to_char(s.month_start, 'YYYYMM') || ':' ||
           regexp_replace(lower(s.outlet), '[^a-z0-9]+', '-', 'g') || ':' || s.sample_number as seed_key,
         case s.sample_number
           when 1 then 'Hired'
           when 2 then 'For Interview'
           when 3 then 'Pending review'
           when 4 then 'Rejected'
           when 5 then 'Withdrawn'
           else 'Hired'
         end as recruitment_status,
         case when s.sample_number in (1, 6) then employee.employee_id else null end as employee_id,
         1 + mod(abs(hashtext(s.outlet || s.month_start::text || ':recruitment:' || s.sample_number)::bigint), 28)::integer as day_offset
  from slots s
  left join lateral (
    select e.employee_id
    from public.employees e
    where lower(btrim(coalesce(e.status, ''))) = 'active'
      and btrim(e.outlet) = s.outlet
    order by md5(e.employee_id || s.month_start::text || s.sample_number::text)
    limit 1
  ) employee on s.sample_number in (1, 6)
)
insert into public.hr_analytics_demo_records
  (seed_key, record_type, employee_id, outlet, record_date, status)
select seed_key, 'recruitment', employee_id, outlet,
       month_start + (day_offset - 1), recruitment_status
from samples
on conflict (seed_key) do update set
  employee_id = excluded.employee_id,
  outlet = excluded.outlet,
  record_date = excluded.record_date,
  status = excluded.status;

notify pgrst, 'reload schema';
commit;

