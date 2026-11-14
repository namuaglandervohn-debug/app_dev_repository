begin;

create schema if not exists hris_private;

create function hris_private.list_staff_job_titles()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct btrim(posting.title)), array[]::text[])
  from public.job_postings as posting
  where (select auth.uid()) is not null
    and (select public.hris_has_role(array['hr_admin', 'general_manager', 'accounting_finance', 'supervisor', 'employee']))
    and btrim(posting.title) <> '';
$$;

create function public.list_staff_job_titles()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select hris_private.list_staff_job_titles();
$$;

revoke all on function hris_private.list_staff_job_titles() from public, anon, authenticated;
revoke all on function public.list_staff_job_titles() from public, anon, authenticated;
grant usage on schema hris_private to authenticated;
grant execute on function hris_private.list_staff_job_titles() to authenticated;
grant execute on function public.list_staff_job_titles() to authenticated;

commit;
