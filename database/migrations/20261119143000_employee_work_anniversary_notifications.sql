begin;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_key_key
  on public.notifications(dedupe_key) where dedupe_key is not null;

create or replace function public.generate_work_anniversary_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_today date := (pg_catalog.clock_timestamp() at time zone 'Asia/Manila')::date;
  added_count integer := 0;
begin
  insert into public.notifications(recipient_role, title, message, type, dedupe_key, created_at)
  select
    'hr',
    'Work Anniversary — ' || anniversary.service_years || ' year' || case when anniversary.service_years = 1 then '' else 's' end,
    pg_catalog.format('%s has completed %s year%s of service today. Hire date: %s. Employee ID: %s.',
      pg_catalog.concat_ws(' ', nullif(pg_catalog.btrim(employee.first_name), ''),
        nullif(pg_catalog.btrim(employee.middle_name), ''), nullif(pg_catalog.btrim(employee.last_name), ''),
        nullif(pg_catalog.btrim(employee.suffix), '')),
      anniversary.service_years,
      case when anniversary.service_years = 1 then '' else 's' end,
      pg_catalog.to_char(employee.hire_date, 'Mon DD, YYYY'),
      employee.employee_id),
    'anniversary',
    'work-anniversary:' || employee.employee_id || ':' || anniversary.service_years || ':' || pg_catalog.to_char(local_today, 'YYYY'),
    pg_catalog.now()
  from public.employees as employee
  cross join lateral (
    select pg_catalog.make_date(
      pg_catalog.date_part('year', local_today)::integer,
      pg_catalog.date_part('month', employee.hire_date)::integer,
      least(
        pg_catalog.date_part('day', employee.hire_date)::integer,
        pg_catalog.date_part('day', (
          pg_catalog.date_trunc('month', pg_catalog.make_date(
            pg_catalog.date_part('year', local_today)::integer,
            pg_catalog.date_part('month', employee.hire_date)::integer,
            1
          )) + interval '1 month' - interval '1 day'
        )::date)::integer
      )
    ) as anniversary_date,
    pg_catalog.date_part('year', local_today)::integer - pg_catalog.date_part('year', employee.hire_date)::integer as service_years
  ) as anniversary
  where employee.hire_date is not null
    and employee.hire_date < local_today
    and anniversary.anniversary_date = local_today
    and anniversary.service_years >= 1
    and pg_catalog.lower(pg_catalog.btrim(coalesce(employee.status, ''))) in ('active', 'on leave')
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics added_count = row_count;
  return added_count;
end;
$$;

revoke all on function public.generate_work_anniversary_notifications() from public, anon, authenticated;

-- Supabase's pg_cron runs this once daily at 00:00 UTC (08:00 in the Philippines).
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'hr-work-anniversary-notifications';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
  perform cron.schedule(
    'hr-work-anniversary-notifications',
    '0 0 * * *',
    'select public.generate_work_anniversary_notifications();'
  );
end;
$$;

commit;
