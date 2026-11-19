begin;

alter table public.employee_account_requests
  add column if not exists submitted_full_name text;

create or replace function public.register_employee_account_request()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  requested_employee_id text;
  requested_full_name text;
  matched_employee public.employees;
  normalized_email text;
  employee_name text;
begin
  if new.raw_user_meta_data->>'registration_kind' <> 'employee' then return new; end if;

  requested_employee_id := nullif(btrim(new.raw_user_meta_data->>'employee_id'), '');
  requested_full_name := nullif(regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), '\s+', ' ', 'g'), '');
  normalized_email := lower(btrim(coalesce(new.email, '')));
  if requested_employee_id is null or normalized_email = '' then
    raise exception 'Enter your existing employee ID and email address.';
  end if;

  perform pg_advisory_xact_lock(hashtext('employee-account-registration'), hashtext(requested_employee_id));

  select * into matched_employee from public.employees
  where upper(btrim(employee_id)) = upper(requested_employee_id)
  for share;
  if not found then raise exception 'That employee ID was not found. Check it or contact HR.'; end if;

  employee_name := concat_ws(' ', nullif(btrim(matched_employee.first_name), ''),
    nullif(btrim(matched_employee.middle_name), ''), nullif(btrim(matched_employee.last_name), ''),
    nullif(btrim(matched_employee.suffix), ''));
  if exists (select 1 from public.user_accounts where employee_id = matched_employee.employee_id) then
    raise exception 'This employee already has an HRIS account. Contact HR if you cannot sign in.';
  end if;
  if exists (select 1 from public.employee_account_requests where employee_id = matched_employee.employee_id and status = 'Pending') then
    raise exception 'An account request for this employee is already awaiting HR review.';
  end if;
  if exists (select 1 from public.user_accounts where lower(email) = normalized_email) then
    raise exception 'This email is already assigned to an HRIS account. Contact HR.';
  end if;

  insert into public.employee_account_requests(auth_user_id, employee_id, email, full_name, submitted_full_name)
  values (new.id, matched_employee.employee_id, normalized_email, employee_name,
    coalesce(requested_full_name, employee_name));
  return new;
end; $$;

commit;
