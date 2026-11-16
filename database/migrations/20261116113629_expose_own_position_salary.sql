begin;

-- Expose the rate used for the linked employee's current position, including closed postings.
create function hris_private.get_own_position_daily_rate(p_employee_id text)
returns text
language sql stable security definer set search_path = ''
as $$
  select substring(replace(j.salary_range, ',', '') from '[0-9]+(?:\.[0-9]+)?')
  from public.employees e
  join public.job_postings j on lower(btrim(j.title)) = lower(btrim(e.position))
  where e.employee_id = p_employee_id
    and hris_private.is_own_employee(p_employee_id)
    and btrim(e.position) <> ''
    and substring(replace(j.salary_range, ',', '') from '[0-9]+(?:\.[0-9]+)?') ~ '[1-9]'
  order by j.is_active desc nulls last, j.updated_at desc nulls last, j.id
  limit 1;
$$;

create function public.get_own_position_daily_rate(p_employee_id text)
returns text
language sql stable security invoker set search_path = ''
as $$
  select hris_private.get_own_position_daily_rate(p_employee_id);
$$;

revoke all on function hris_private.get_own_position_daily_rate(text) from public, anon, authenticated;
revoke all on function public.get_own_position_daily_rate(text) from public, anon, authenticated;
grant execute on function hris_private.get_own_position_daily_rate(text) to authenticated;
grant execute on function public.get_own_position_daily_rate(text) to authenticated;

commit;
