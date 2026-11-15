begin;

create function hris_private.is_own_employee(target text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_accounts
    where (select auth.uid()) is not null and (auth_user_id = (select auth.uid())
      or (auth_user_id is null and lower(email) = lower((select auth.jwt()) ->> 'email'))) and is_active
      and role = 'employee' and employee_id = target
  );
$$;
revoke all on function hris_private.is_own_employee(text) from public, anon, authenticated;
grant execute on function hris_private.is_own_employee(text) to authenticated;

create function hris_private.has_released_payslip(target text, employee text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select hris_private.is_own_employee(employee) and exists (
    select 1 from public.payroll_summaries
    where payroll_id = target and status in ('Endorsed','Exported')
  );
$$;
revoke all on function hris_private.has_released_payslip(text,text) from public, anon, authenticated;
grant execute on function hris_private.has_released_payslip(text,text) to authenticated;

do $$
declare
  target text;
  staff_only text := '(select public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'',''supervisor'']))';
begin
  foreach target in array array['attendance_logs','attendance_summaries','employees','schedule','employee_requests',
    'employee_leave_balances','employee_evaluations'] loop
    execute format('create policy "Limit employee reads to own records" on public.%I as restrictive for select to authenticated
      using (%s or hris_private.is_own_employee(employee_id))', target, staff_only);
  end loop;

  foreach target in array array['attendance_logs','attendance_summaries','employee_leave_balances',
    'employee_evaluations','employee_evaluation_scores'] loop
    execute format('create policy "Restrict employee inserts" on public.%I as restrictive for insert to authenticated with check (%s)', target, staff_only);
    execute format('create policy "Restrict employee updates" on public.%I as restrictive for update to authenticated using (%s) with check (%s)', target, staff_only, staff_only);
    execute format('create policy "Restrict employee deletes" on public.%I as restrictive for delete to authenticated using (%s)', target, staff_only);
  end loop;
end;
$$;

create policy "Restrict staff payroll item reads" on public.payroll_items as restrictive for select to authenticated
  using ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance']))
    or hris_private.has_released_payslip(payroll_id, employee_id));

create policy "Limit payroll summaries to employee payslips" on public.payroll_summaries as restrictive for select to authenticated
  using ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance']))
    or (status in ('Endorsed','Exported') and exists (
      select 1 from public.payroll_items item where item.payroll_id = payroll_summaries.payroll_id
        and hris_private.is_own_employee(item.employee_id))));

do $$
declare
  target text;
  payroll_staff text := '(select public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'']))';
begin
  foreach target in array array['payroll_items','payroll_summaries'] loop
    execute format('create policy "Limit payroll inserts to payroll staff" on public.%I as restrictive for insert to authenticated
      with check (%s)', target, payroll_staff);
    execute format('create policy "Limit payroll updates to payroll staff" on public.%I as restrictive for update to authenticated
      using (%s) with check (%s)', target, payroll_staff, payroll_staff);
    execute format('create policy "Limit payroll deletes to payroll staff" on public.%I as restrictive for delete to authenticated
      using (%s)', target, payroll_staff);
  end loop;
end;
$$;

create policy "Limit employee evaluation score reads" on public.employee_evaluation_scores as restrictive for select to authenticated
  using ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance','supervisor']))
    or exists (select 1 from public.employee_evaluations assessment
      where assessment.evaluation_id = employee_evaluation_scores.evaluation_id
        and hris_private.is_own_employee(assessment.employee_id)));

create policy "Limit employee request creation" on public.employee_requests as restrictive for insert to authenticated
  with check ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance','supervisor']))
    or (hris_private.is_own_employee(employee_id) and status = 'Pending'
      and supervisor_status = 'Pending' and hr_status = 'Pending'));

create function hris_private.guard_employee_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.hris_has_role(array['employee']) then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;
  if TG_OP <> 'UPDATE' then raise exception 'Employee accounts cannot perform this action'; end if;
  if not hris_private.is_own_employee(OLD.employee_id) then raise exception 'Employee record access denied'; end if;
  if TG_TABLE_NAME = 'employees' then
    if (to_jsonb(NEW) - array['phone_number','email','address','emergency_contact','updated_at']) =
       (to_jsonb(OLD) - array['phone_number','email','address','emergency_contact','updated_at']) then return NEW; end if;
  elsif TG_TABLE_NAME = 'schedule' then
    if OLD.status = 'Published' and NEW.status in ('Confirmed','Declined')
      and (to_jsonb(NEW) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at']) =
          (to_jsonb(OLD) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at']) then return NEW; end if;
  elsif TG_TABLE_NAME = 'employee_requests' then
    if OLD.status = 'Pending' and NEW.status = 'Cancelled'
      and (to_jsonb(NEW) - array['status','updated_at']) = (to_jsonb(OLD) - array['status','updated_at']) then return NEW; end if;
  end if;
  raise exception 'Employee account cannot change these fields';
end;
$$;
revoke all on function hris_private.guard_employee_changes() from public, anon, authenticated, service_role;

create trigger guard_employee_changes before insert or update or delete on public.employees
  for each row execute function hris_private.guard_employee_changes();
create trigger guard_employee_changes before insert or update or delete on public.schedule
  for each row execute function hris_private.guard_employee_changes();
create trigger guard_employee_changes before update on public.employee_requests
  for each row execute function hris_private.guard_employee_changes();
create policy "Restrict employee request deletion" on public.employee_requests as restrictive for delete to authenticated
  using ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance','supervisor'])));

create function hris_private.guard_payroll_release()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null and NEW.status in ('Endorsed','Exported') and OLD.status is distinct from NEW.status
     and not public.hris_has_role(array['accounting_finance','general_manager']) then
    raise exception 'Only Accounting or the General Manager can release payroll';
  end if;
  return NEW;
end;
$$;
revoke all on function hris_private.guard_payroll_release() from public, anon, authenticated, service_role;
create trigger guard_payroll_release before update of status on public.payroll_summaries
  for each row execute function hris_private.guard_payroll_release();

commit;
