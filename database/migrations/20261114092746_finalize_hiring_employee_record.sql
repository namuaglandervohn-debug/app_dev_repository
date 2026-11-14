create or replace function public.forward_hired_applicant()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  employee_code text;
  matched_employee public.employees%rowtype;
  prior_owner uuid;
  prior_exists boolean;
  email_key text := nullif(lower(btrim(new.email)), '');
  hire_day date := (now() at time zone 'Asia/Manila')::date;
  year_prefix text := 'EMP-' || to_char(hire_day, 'YYYY') || '-';
  next_number bigint;
begin
  if exists (select 1 from public.employees where applicant_id = new.applicant_id) then
    return new;
  end if;

  perform pg_advisory_xact_lock(778813);
  for attempt in 1..12 loop
    if email_key is not null then
      select * into matched_employee from public.employees
      where lower(btrim(email)) = email_key order by employee_id limit 1 for update;
      if found then
        select auth_user_id into prior_owner from public.applicants
        where applicant_id = matched_employee.applicant_id;
        prior_exists := found;
        if new.auth_user_id is null
          or not exists (select 1 from auth.users where id = new.auth_user_id
            and email_confirmed_at is not null and lower(btrim(email)) = email_key)
          or matched_employee.status is distinct from 'Active'
          or new.birthdate is null or new.birthdate is distinct from matched_employee.birthdate
          or nullif(lower(btrim(new.first_name)), '') is null
          or nullif(lower(btrim(new.last_name)), '') is null
          or lower(btrim(new.first_name)) is distinct from lower(btrim(matched_employee.first_name))
          or lower(btrim(new.last_name)) is distinct from lower(btrim(matched_employee.last_name))
          or (prior_exists and prior_owner is distinct from new.auth_user_id)
          or exists (select 1 from public.employees where lower(btrim(email)) = email_key
            and employee_id <> matched_employee.employee_id)
          or (select count(*) from public.user_accounts where employee_id = matched_employee.employee_id) > 1
          or exists (select 1 from public.user_accounts where applicant_id = new.applicant_id
            and employee_id is distinct from matched_employee.employee_id)
          or exists (select 1 from public.user_accounts where employee_id = matched_employee.employee_id
            and (role is distinct from 'employee' or is_active is distinct from true
              or (auth_user_id is not null and (auth_user_id = new.auth_user_id or lower(btrim(email)) = email_key))
              or (applicant_id is not null and applicant_id is distinct from matched_employee.applicant_id
                and applicant_id is distinct from new.applicant_id)))
        then
          raise exception 'An employee already uses this email. Ask HR to verify the employee record before hiring.'
            using errcode = 'P0001';
        end if;
        update public.employees set applicant_id = new.applicant_id
        where employee_id = matched_employee.employee_id;
        update public.user_accounts set applicant_id = new.applicant_id
        where employee_id = matched_employee.employee_id
          and applicant_id is not null and applicant_id = matched_employee.applicant_id;
        return new;
      end if;
    end if;

    select coalesce(max(substring(employee_id from '[0-9]+$')::bigint), 0) + 1
      into next_number from public.employees where employee_id ~ ('^' || year_prefix || '[0-9]{1,12}$');
    insert into public.employees (
      employee_id, applicant_id, first_name, middle_name, last_name, suffix, email, phone_number,
      address, gender, civil_status, birthdate, birthplace, position, outlet, status, hire_date,
      education, experience, tin, sss, philhealth, pagibig, emergency_contact
    ) values (
      year_prefix || lpad(next_number::text, greatest(4, length(next_number::text)), '0'),
      new.applicant_id, new.first_name, new.middle_name, new.last_name, new.suffix, email_key, new.phone_number,
      new.address, new.gender, new.civil_status, new.birthdate, new.birthplace, new.position_applied, '', 'Active', hire_day,
      new.education, new.experience, new.tin, new.sss, new.philhealth, new.pagibig, new.emergency_contact
    ) on conflict do nothing returning employee_id into employee_code;
    if employee_code is not null or exists (
      select 1 from public.employees where applicant_id = new.applicant_id
    ) then return new; end if;
    if not exists (select 1 from public.employees where employee_id =
      year_prefix || lpad(next_number::text, greatest(4, length(next_number::text)), '0')
      or (email_key is not null and lower(btrim(email)) = email_key)) then
      raise exception 'The employee record could not be saved. Ask HR to review the employee records.' using errcode = 'P0001';
    end if;
  end loop;
  raise exception 'The employee record changed during hiring. Refresh and try again.' using errcode = 'P0001';
end;
$$;
