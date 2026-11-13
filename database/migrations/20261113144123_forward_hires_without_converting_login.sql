create or replace function public.forward_hired_applicant()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  employee_code text;
  year_prefix text := 'EMP-' || to_char(current_date, 'YYYY') || '-';
  next_number bigint;
begin
  select employee_id into employee_code from public.employees where applicant_id = new.applicant_id;
  if employee_code is null then
    perform pg_advisory_xact_lock(778813);
    select coalesce(max(substring(employee_id from '[0-9]+$')::bigint), 0) + 1
      into next_number from public.employees where employee_id ~ ('^' || year_prefix || '[0-9]{1,12}$');
    loop
      insert into public.employees (
        employee_id, applicant_id, first_name, middle_name, last_name, suffix, email, phone_number,
        address, gender, civil_status, birthdate, birthplace, position, outlet, status, hire_date,
        education, experience, tin, sss, philhealth, pagibig, emergency_contact
      ) values (
        year_prefix || lpad(next_number::text, greatest(4, length(next_number::text)), '0'),
        new.applicant_id, new.first_name, new.middle_name, new.last_name, new.suffix, new.email, new.phone_number,
        new.address, new.gender, new.civil_status, new.birthdate, new.birthplace, new.position_applied, '', 'Active', current_date,
        new.education, new.experience, new.tin, new.sss, new.philhealth, new.pagibig, new.emergency_contact
      ) on conflict (employee_id) do nothing returning employee_id into employee_code;
      exit when employee_code is not null;
      next_number := next_number + 1;
    end loop;
  end if;

  return new;
end;
$$;
