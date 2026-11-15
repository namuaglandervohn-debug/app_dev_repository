begin;

create function hris_private.sync_employee_outlet_to_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.hris_has_role(array['hr_admin', 'general_manager']) then
    if NEW.outlet is distinct from OLD.outlet then
      raise exception 'Only HR or the General Manager can change an employee outlet';
    end if;
    return NEW;
  end if;

  update public.user_accounts
  set outlet = NEW.outlet
  where employee_id = NEW.employee_id and outlet is distinct from NEW.outlet;
  return NEW;
end;
$$;

revoke all on function hris_private.sync_employee_outlet_to_accounts() from public, anon, authenticated, service_role;

create trigger sync_employee_outlet_to_accounts
  after update of outlet on public.employees
  for each row execute function hris_private.sync_employee_outlet_to_accounts();

commit;
