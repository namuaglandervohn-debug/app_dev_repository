begin;

create table if not exists public.employee_account_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  employee_id text not null,
  email text not null,
  full_name text not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text
);

create index if not exists employee_account_requests_status_created_idx
  on public.employee_account_requests(status, created_at desc);
create unique index if not exists employee_account_requests_one_pending_per_employee
  on public.employee_account_requests(employee_id) where status = 'Pending';
create unique index if not exists employee_account_requests_pending_email_key
  on public.employee_account_requests(lower(email)) where status = 'Pending';

-- Keep all account-creation paths from linking multiple logins to one employee.
create unique index if not exists user_accounts_employee_id_key
  on public.user_accounts(employee_id) where employee_id is not null;

alter table public.employee_account_requests enable row level security;
revoke all on public.employee_account_requests from anon, authenticated;
drop policy if exists "Employees read own account request" on public.employee_account_requests;
create policy "Employees read own account request" on public.employee_account_requests
  for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "HR read employee account requests" on public.employee_account_requests;
create policy "HR read employee account requests" on public.employee_account_requests
  for select to authenticated using (public.hris_has_role(array['hr_admin']));
grant select on public.employee_account_requests to authenticated;

create or replace function public.register_employee_account_request()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  requested_employee_id text;
  matched_employee public.employees;
  normalized_email text;
  employee_name text;
begin
  if new.raw_user_meta_data->>'registration_kind' <> 'employee' then return new; end if;

  requested_employee_id := nullif(btrim(new.raw_user_meta_data->>'employee_id'), '');
  normalized_email := lower(btrim(coalesce(new.email, '')));
  if requested_employee_id is null or normalized_email = '' then
    raise exception 'Enter your existing employee ID and email address.';
  end if;

  -- Serialize registrations for a single employee so concurrent signups cannot
  -- create multiple pending claims for the same employee record.
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

  insert into public.employee_account_requests(auth_user_id, employee_id, email, full_name)
  values (new.id, matched_employee.employee_id, normalized_email, employee_name);
  return new;
end; $$;

revoke all on function public.register_employee_account_request() from public, anon, authenticated;
drop trigger if exists register_employee_account_request on auth.users;
create trigger register_employee_account_request after insert on auth.users
for each row execute function public.register_employee_account_request();

create or replace function public.approve_employee_account_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  request_row public.employee_account_requests;
  employee_row public.employees;
  auth_row auth.users;
  account_row public.user_accounts;
  generated_user_id text;
begin
  if not public.hris_has_role(array['hr_admin']) then
    raise exception 'Only HR/Admin can approve employee account requests.';
  end if;

  select * into request_row from public.employee_account_requests where id = p_request_id for update;
  if not found or request_row.status <> 'Pending' then raise exception 'This request is no longer pending.'; end if;

  select * into employee_row from public.employees where employee_id = request_row.employee_id for update;
  if not found then raise exception 'The linked employee record no longer exists.'; end if;
  if exists (select 1 from public.user_accounts where employee_id = employee_row.employee_id) then
    raise exception 'This employee already has an HRIS account. No account was created.';
  end if;

  select * into auth_row from auth.users where id = request_row.auth_user_id;
  if not found then raise exception 'The registration login no longer exists.'; end if;
  if auth_row.email_confirmed_at is null then raise exception 'The employee must confirm the registration email before HR approval.'; end if;
  if lower(coalesce(auth_row.email, '')) <> lower(request_row.email) then raise exception 'The registration email no longer matches the login.'; end if;
  if exists (select 1 from public.user_accounts where lower(email) = lower(request_row.email)) then
    raise exception 'This email is already assigned to another HRIS account.';
  end if;

  generated_user_id := 'USR-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  insert into public.user_accounts(user_id, auth_user_id, employee_id, full_name, first_name, middle_name,
      last_name, suffix, email, password, role, outlet, is_active)
  values(generated_user_id, auth_row.id, employee_row.employee_id,
      concat_ws(' ', nullif(btrim(employee_row.first_name), ''), nullif(btrim(employee_row.middle_name), ''),
        nullif(btrim(employee_row.last_name), ''), nullif(btrim(employee_row.suffix), '')),
      employee_row.first_name, employee_row.middle_name, employee_row.last_name, employee_row.suffix,
      lower(request_row.email), null, 'employee', employee_row.outlet, true)
  returning * into account_row;

  update public.employee_account_requests set status = 'Approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_row.id;

  return jsonb_build_object('approved', true, 'employee_id', account_row.employee_id, 'user_id', account_row.user_id);
end; $$;
revoke all on function public.approve_employee_account_request(uuid) from public, anon;
grant execute on function public.approve_employee_account_request(uuid) to authenticated;

create or replace function public.reject_employee_account_request(p_request_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare request_row public.employee_account_requests;
begin
  if not public.hris_has_role(array['hr_admin']) then
    raise exception 'Only HR/Admin can reject employee account requests.';
  end if;
  select * into request_row from public.employee_account_requests where id = p_request_id for update;
  if not found or request_row.status <> 'Pending' then raise exception 'This request is no longer pending.'; end if;
  update public.employee_account_requests set status = 'Rejected', reviewed_by = auth.uid(), reviewed_at = now(),
    reviewer_note = left(nullif(btrim(p_note), ''), 500)
  where id = request_row.id;
  return jsonb_build_object('rejected', true, 'employee_id', request_row.employee_id);
end; $$;
revoke all on function public.reject_employee_account_request(uuid, text) from public, anon;
grant execute on function public.reject_employee_account_request(uuid, text) to authenticated;

commit;
