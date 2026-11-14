begin;

create schema if not exists hris_private;

create function hris_private.record_system_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_auth_id uuid := auth.uid();
  actor_name text;
  actor_role text;
  record_key text;
begin
  if TG_OP = 'UPDATE' and NEW is not distinct from OLD then
    return null;
  end if;

  if actor_auth_id is not null then
    select account.full_name, account.role
      into actor_name, actor_role
      from public.user_accounts as account
      where account.auth_user_id = actor_auth_id and account.is_active;
  end if;

  if TG_OP = 'DELETE' then
    execute pg_catalog.format('select ($1).%I::text', TG_ARGV[1]) into record_key using OLD;
  else
    execute pg_catalog.format('select ($1).%I::text', TG_ARGV[1]) into record_key using NEW;
  end if;

  insert into public.system_logs (user_name, user_role, action, module, record_id, record_table, description)
  values (
    coalesce(nullif(actor_name, ''), case when actor_auth_id is null then 'System' else 'Signed-in user' end),
    actor_role,
    case TG_OP when 'INSERT' then 'Created' when 'UPDATE' then 'Updated' else 'Deleted' end,
    TG_ARGV[0], record_key, TG_TABLE_NAME, TG_ARGV[2]
  );
  return null;
end;
$$;

revoke execute on function hris_private.record_system_activity() from public, anon, authenticated, service_role;

do $$
declare
  source record;
begin
  for source in select * from (values
    ('applicants', 'Recruitment', 'applicant_id', 'Application record'),
    ('job_postings', 'Job Postings', 'id', 'Job posting'),
    ('user_accounts', 'User Accounts', 'user_id', 'User account'),
    ('employees', 'Employees', 'employee_id', 'Employee record'),
    ('schedule', 'Schedule', 'schedule_id', 'Employee schedule'),
    ('attendance_logs', 'Attendance', 'log_id', 'Attendance entry'),
    ('attendance_summaries', 'Attendance', 'summary_id', 'Attendance summary'),
    ('payroll_items', 'Payroll', 'payroll_item_id', 'Payslip'),
    ('payroll_summaries', 'Payroll', 'payroll_id', 'Payroll summary'),
    ('payroll_premium_rates', 'Payroll', 'id', 'Payroll rate settings'),
    ('employee_requests', 'Requests', 'request_id', 'Employee request'),
    ('employee_evaluations', 'Evaluation', 'evaluation_id', 'Employee evaluation'),
    ('evaluation_criteria', 'Evaluation', 'criteria_id', 'Evaluation criterion')
  ) as sources(table_name, module, key_column, description)
  loop
    execute format(
      'create trigger record_system_activity after insert or update or delete on public.%I
       for each row execute function hris_private.record_system_activity(%L, %L, %L)',
      source.table_name, source.module, source.key_column, source.description
    );
  end loop;
end;
$$;

revoke all on table public.system_logs from public, anon, authenticated;
grant select (id, log_id, user_name, user_role, action, module, record_id, record_table, description, created_at)
  on public.system_logs to authenticated;
revoke execute on function public.create_system_log(text,text,text,text,text,text,text,text,jsonb,jsonb,text,text)
  from public, anon, authenticated;

drop policy "Internal account access" on public.system_logs;
drop policy "Require internal account" on public.system_logs;
create policy "Report staff read activity" on public.system_logs for select to authenticated
  using ((select public.hris_has_role(array['hr_admin', 'general_manager', 'accounting_finance'])));

insert into public.system_logs (user_name, action, module, description)
values ('System', 'Enabled', 'System', 'Activity logging enabled');

commit;
