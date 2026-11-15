begin;

alter table public.attendance_logs
  add column reviewed_by_name text,
  add column reviewed_at timestamptz;

create function hris_private.stamp_attendance_review()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' and OLD.validation_status in ('Needs Review', 'Unprocessed', 'Corrected')
     and NEW.validation_status = 'Validated' then
    if not public.hris_has_role(array['hr_admin','general_manager','supervisor']) then
      raise exception 'Only attendance reviewers can validate an exception';
    end if;
    select full_name into NEW.reviewed_by_name
      from public.user_accounts where is_active and (
        auth_user_id = auth.uid() or (auth_user_id is null and lower(email) = lower(auth.jwt()->>'email'))
      )
      order by auth_user_id nulls last limit 1;
    NEW.reviewed_at := now();
  elsif TG_OP = 'UPDATE' and (NEW is not distinct from OLD) then
    return NEW;
  else
    NEW.reviewed_by_name := null;
    NEW.reviewed_at := null;
  end if;
  return NEW;
end;
$$;
revoke all on function hris_private.stamp_attendance_review() from public, anon, authenticated, service_role;

create trigger stamp_attendance_review before insert or update on public.attendance_logs
  for each row execute function hris_private.stamp_attendance_review();

alter table public.applicants add column employee_setup_email_sent_at timestamptz;

create or replace function hris_private.record_system_activity()
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
    case
      when TG_OP = 'UPDATE' and TG_TABLE_NAME = 'applicants'
        and to_jsonb(NEW)->>'status' = 'Hired' and to_jsonb(OLD)->>'status' is distinct from 'Hired' then 'Applicant Hired'
      when TG_OP = 'UPDATE' and TG_TABLE_NAME = 'payroll_summaries'
        and to_jsonb(NEW)->>'status' in ('Endorsed','Exported')
        and coalesce(to_jsonb(OLD)->>'status','') not in ('Endorsed','Exported') then 'Payroll Released'
      when TG_OP = 'UPDATE' and TG_TABLE_NAME = 'attendance_logs'
        and to_jsonb(NEW)->>'reviewed_at' is distinct from to_jsonb(OLD)->>'reviewed_at'
        and to_jsonb(NEW)->>'reviewed_at' is not null then 'Attendance Reviewed'
      when TG_OP = 'INSERT' then 'Created'
      when TG_OP = 'UPDATE' then 'Updated'
      else 'Deleted'
    end,
    TG_ARGV[0], record_key, TG_TABLE_NAME, TG_ARGV[2]
  );
  return null;
end;
$$;

commit;
