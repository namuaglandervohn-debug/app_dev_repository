begin;

create function hris_private.enforce_annual_leave_request_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowance numeric;
  reserved_days integer;
  requested_days integer;
  calendar_year integer;
  year_start date;
  year_end date;
  check_approved_only boolean := false;
begin
  if new.request_type <> 'Leave' or new.status not in ('Pending', 'Supervisor Approved', 'Approved') then
    return new;
  end if;

  if auth.uid() is not null
    and not public.hris_has_role(array['hr_admin', 'general_manager', 'accounting_finance', 'supervisor'])
    and not hris_private.is_own_employee(new.employee_id) then
    raise exception 'Employee request access denied.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.request_type = 'Leave'
    and old.status in ('Pending', 'Supervisor Approved', 'Approved')
    and new.employee_id = old.employee_id
    and new.start_date = old.start_date and new.end_date = old.end_date then
    if new.status <> 'Approved' or old.status = 'Approved' then
      return new;
    end if;
    -- Existing pending requests may predate reservations. Check actual approvals first.
    check_approved_only := true;
  end if;

  if new.start_date is null or new.end_date is null or new.end_date < new.start_date then
    raise exception 'Enter a valid date range for leave.' using errcode = '23514';
  end if;
  new.total_days := new.end_date - new.start_date + 1;

  -- Serialize requests against this employee's allowance, including when no balance row exists.
  perform 1 from public.employees
    where employee_id = new.employee_id for no key update;
  select balance.available into allowance
    from public.employee_leave_balances balance
    where balance.employee_id = new.employee_id and balance.leave_type = 'Company Paid Leave'
    for no key update;
  allowance := coalesce(allowance, 5);

  for calendar_year in extract(year from new.start_date)::integer .. extract(year from new.end_date)::integer loop
    year_start := make_date(calendar_year, 1, 1);
    year_end := make_date(calendar_year, 12, 31);
    requested_days := least(year_end, new.end_date) - greatest(year_start, new.start_date) + 1;

    select coalesce(sum(least(request.end_date, year_end) - greatest(request.start_date, year_start) + 1), 0)
      into reserved_days
      from public.employee_requests request
      where request.employee_id = new.employee_id
        and request.id is distinct from new.id
        and request.request_type = 'Leave'
        and request.status in ('Pending', 'Supervisor Approved', 'Approved')
        and (not check_approved_only or request.status = 'Approved')
        and request.start_date <= year_end and request.end_date >= year_start;

    if requested_days + reserved_days > allowance then
      raise exception 'Only % leave day(s) are available to request in %.',
        greatest(allowance - reserved_days, 0), calendar_year using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function hris_private.enforce_annual_leave_request_balance() from public, anon, authenticated, service_role;

create trigger enforce_annual_leave_request_balance
before insert or update of employee_id, request_type, status, start_date, end_date
on public.employee_requests for each row
execute function hris_private.enforce_annual_leave_request_balance();

create function hris_private.require_hr_for_final_request_approval()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.hris_has_role(array['hr_admin'])
    and (new.status = 'Approved' or new.hr_status = 'Approved'
      or (tg_op = 'UPDATE' and (old.status = 'Approved' or old.hr_status = 'Approved'))) then
    raise exception 'Only HR can validate or change a final request approval.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function hris_private.require_hr_for_final_request_approval() from public, anon, authenticated, service_role;
create trigger check_hr_request_approval
before insert or update on public.employee_requests for each row
execute function hris_private.require_hr_for_final_request_approval();

commit;
