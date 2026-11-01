begin;

create or replace function public.hris_has_role(allowed text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_accounts a where a.is_active = true
    and (a.auth_user_id = auth.uid() or (a.auth_user_id is null and lower(a.email) = lower(auth.jwt()->>'email')))
    and a.role = any(allowed));
$$;
revoke all on function public.hris_has_role(text[]) from public;
grant execute on function public.hris_has_role(text[]) to authenticated;

create table if not exists public.applicant_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applicant_profile_names check (length(trim(coalesce(profile->>'firstName',''))) > 0 and length(trim(coalesce(profile->>'lastName',''))) > 0),
  constraint applicant_profile_birthdate check (coalesce(profile->>'birthdate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint applicant_profile_size check (octet_length(profile::text) <= 100000)
);
alter table public.applicant_profiles enable row level security;
drop policy if exists "Applicants read own reusable profile" on public.applicant_profiles;
create policy "Applicants read own reusable profile" on public.applicant_profiles for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "Applicants update own reusable profile" on public.applicant_profiles;
create policy "Applicants update own reusable profile" on public.applicant_profiles for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
grant select on public.applicant_profiles to authenticated;
grant update(profile,updated_at) on public.applicant_profiles to authenticated;

create or replace function public.register_applicant_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data->>'registration_kind' = 'applicant' then
    if coalesce(trim(new.raw_user_meta_data->'applicant_profile'->>'firstName'), '') = ''
      or coalesce(trim(new.raw_user_meta_data->'applicant_profile'->>'lastName'), '') = ''
      or coalesce(new.raw_user_meta_data->'applicant_profile'->>'birthdate', '') = '' then
      raise exception 'First name, last name and date of birth are required.';
    end if;
    insert into public.applicant_profiles(auth_user_id,profile)
      values(new.id, new.raw_user_meta_data->'applicant_profile');
  end if;
  return new;
end; $$;
drop trigger if exists register_applicant_profile on auth.users;
create trigger register_applicant_profile after insert on auth.users
for each row execute function public.register_applicant_profile();

alter table public.applicants add column if not exists auth_user_id uuid references auth.users(id);
create index if not exists applicants_auth_user_id_idx on public.applicants(auth_user_id);
alter table public.applicants enable row level security;
drop policy if exists "Staff manage applications" on public.applicants;
create policy "Staff manage applications" on public.applicants for all to authenticated
using (public.hris_has_role(array['hr_admin','general_manager'])) with check (public.hris_has_role(array['hr_admin','general_manager']));
drop policy if exists "Applicants read own applications" on public.applicants;
create policy "Applicants read own applications" on public.applicants for select to authenticated using (auth_user_id = auth.uid());
drop policy if exists "Applicants submit own applications" on public.applicants;
create policy "Applicants submit own applications" on public.applicants for insert to authenticated
with check (auth_user_id = auth.uid() and status = 'Submitted' and exists(select 1 from public.applicant_profiles where auth_user_id = auth.uid()));

create or replace function public.bind_applicant_identity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.role() = 'service_role' or public.hris_has_role(array['hr_admin','general_manager']) then return new; end if;
  if auth.uid() is null then raise exception 'Please create an applicant account and sign in before applying.'; end if;
  if not exists(select 1 from public.applicant_profiles where auth_user_id = auth.uid()) then raise exception 'Complete your applicant registration before applying.'; end if;
  if exists(select 1 from public.user_accounts where auth_user_id = auth.uid()) then raise exception 'This account has already been converted into an employee account.'; end if;
  new.auth_user_id := auth.uid();
  new.email := auth.jwt()->>'email';
  new.status := 'Submitted';
  return new;
end; $$;
drop trigger if exists bind_applicant_identity on public.applicants;
create trigger bind_applicant_identity before insert on public.applicants for each row execute function public.bind_applicant_identity();

create or replace function public.submit_profile_application(p_application jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare next_number bigint; tracking_id text; allowed jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.applicant_profiles where auth_user_id=auth.uid()) then
    raise exception 'Please register and sign in before applying.';
  end if;
  if exists(select 1 from public.user_accounts where auth_user_id=auth.uid()) then raise exception 'This login is already an employee account.'; end if;
  perform pg_advisory_xact_lock(778812);
  select coalesce(max(substring(applicant_id from '[0-9]+$')::bigint),0)+1 into next_number
  from public.applicants where applicant_id ~ ('^APP-'||to_char(now(),'YYYY')||'-[0-9]{4,9}$');
  tracking_id := 'APP-'||to_char(now(),'YYYY')||'-'||lpad(next_number::text,greatest(4,length(next_number::text)), '0');
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into allowed from jsonb_each(p_application)
  where key=any(array['name','first_name','middle_name','last_name','suffix','gender','civil_status','birthdate','birthplace','height','weight','phone_number','address','position_applied','education','experience','cover_letter','tin','sss','philhealth','pagibig','emergency_contact','resume_file_name','resume_file_data','supporting_documents','supporting_document_files']);
  insert into public.applicants select * from jsonb_populate_record(null::public.applicants,
    allowed || jsonb_build_object('id',gen_random_uuid(),'applicant_id',tracking_id,'auth_user_id',auth.uid(),'email',auth.jwt()->>'email','status','Submitted','created_at',now(),'updated_at',now(),'is_archived',false,'has_resume',false,'has_birth_cert',false,'has_tor',false,'has_med_cert',false));
  return tracking_id;
end; $$;
revoke all on function public.submit_profile_application(jsonb) from public;
grant execute on function public.submit_profile_application(jsonb) to authenticated;

alter table public.user_accounts enable row level security;
drop policy if exists "Users read own account" on public.user_accounts;
create policy "Users read own account" on public.user_accounts for select to authenticated
using (auth_user_id = auth.uid() or (auth_user_id is null and lower(email) = lower(auth.jwt()->>'email')));
drop policy if exists "HR manage accounts" on public.user_accounts;
create policy "HR manage accounts" on public.user_accounts for all to authenticated
using (public.hris_has_role(array['hr_admin'])) with check (public.hris_has_role(array['hr_admin']));
drop policy if exists "Staff read account directory" on public.user_accounts;
create policy "Staff read account directory" on public.user_accounts for select to authenticated
using (public.hris_has_role(array['general_manager','accounting_finance','supervisor']));

drop policy if exists "Employees read linked application" on public.applicants;
create policy "Employees read linked application" on public.applicants for select to authenticated
using (exists(select 1 from public.employees e join public.user_accounts a on a.employee_id=e.employee_id
  where e.applicant_id=applicants.applicant_id and a.role='employee' and a.is_active=true
  and (a.auth_user_id=auth.uid() or (a.auth_user_id is null and lower(a.email)=lower(auth.jwt()->>'email')))));

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 100),
  description text not null default '' check(length(description) <= 1000),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists leave_types_name_key on public.leave_types(lower(trim(name)));
do $$ begin
  if not exists(select 1 from public.leave_types) then
insert into public.leave_types(name) values ('Vacation Leave'),('Sick Leave'),('Emergency Leave'),('Maternity Leave'),('Paternity Leave'),('Bereavement Leave'),('Other') on conflict do nothing;
-- Retain existing custom leave labels without rewriting historical requests.
insert into public.leave_types(name) select distinct trim(leave_type) from public.employee_requests
where request_type='Leave' and nullif(trim(leave_type),'') is not null on conflict do nothing;
  end if;
end; $$;
alter table public.leave_types enable row level security;
drop policy if exists "Staff read leave types" on public.leave_types;
create policy "Staff read leave types" on public.leave_types for select to authenticated
using (public.hris_has_role(array['hr_admin','general_manager','accounting_finance','supervisor','employee']));
drop policy if exists "Super Admin adds leave types" on public.leave_types;
create policy "Super Admin adds leave types" on public.leave_types for insert to authenticated
with check (public.hris_has_role(array['hr_admin']));
drop policy if exists "Super Admin updates leave types" on public.leave_types;
create policy "Super Admin updates leave types" on public.leave_types for update to authenticated
using (public.hris_has_role(array['hr_admin'])) with check (public.hris_has_role(array['hr_admin']));
grant select,insert,update on public.leave_types to authenticated;
revoke delete on public.leave_types from authenticated,anon;

create or replace function public.validate_active_leave_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op='UPDATE' then
    if new.leave_type is not distinct from old.leave_type and new.request_type is not distinct from old.request_type then return new; end if;
  end if;
  if new.request_type='Leave' and not exists(select 1 from public.leave_types where name=new.leave_type and is_active=true) then
    raise exception 'This leave type is no longer available. Please choose an active leave type.';
  end if;
  return new;
end; $$;
drop trigger if exists validate_active_leave_type on public.employee_requests;
create trigger validate_active_leave_type before insert or update of leave_type,request_type on public.employee_requests for each row execute function public.validate_active_leave_type();

create or replace function public.convert_applicant_account(p_applicant_id text,p_employee_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare app public.applicants; emp public.employees; existing public.user_accounts; identity auth.users; saved public.user_accounts;
begin
  if not public.hris_has_role(array['hr_admin','general_manager']) then raise exception 'Only HR/Admin or General Manager can convert applicant accounts.'; end if;
  select * into app from public.applicants where applicant_id=p_applicant_id for update;
  if not found or app.status <> 'Hired' or app.auth_user_id is null then raise exception 'A hired application with an applicant account is required.'; end if;
  select * into emp from public.employees where employee_id=p_employee_id and applicant_id=p_applicant_id;
  if not found then raise exception 'Save the matching employee record first.'; end if;
  select * into identity from auth.users where id=app.auth_user_id;
  if not found then raise exception 'The applicant login no longer exists.'; end if;
  select * into existing from public.user_accounts where auth_user_id=identity.id or employee_id=p_employee_id limit 1;
  if found then
    if existing.auth_user_id is distinct from identity.id or existing.employee_id is distinct from p_employee_id or existing.role <> 'employee' then
      raise exception 'This applicant or employee is already linked to a different account. No account was changed.';
    end if;
    saved := existing;
  else
    insert into public.user_accounts(user_id,auth_user_id,employee_id,full_name,first_name,middle_name,last_name,suffix,email,password,role,outlet,is_active)
    values('USR-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),identity.id,p_employee_id,app.name,app.first_name,app.middle_name,app.last_name,app.suffix,identity.email,null,'employee',emp.outlet,true)
    returning * into saved;
  end if;
  return jsonb_build_object('auth_user_id',identity.id,'email',saved.email,'employee_id',saved.employee_id,'converted',true);
end; $$;
revoke all on function public.convert_applicant_account(text,text) from public;
grant execute on function public.convert_applicant_account(text,text) to authenticated;

-- Public registration must not grant applicant logins access to internal modules.
-- Keep existing employee/staff workflows, but require an active internal account.
do $$
declare relation record;
begin
  for relation in select tablename from pg_tables where schemaname='public'
    and tablename not in ('applicants','applicant_profiles','user_accounts','leave_types','job_postings','employee_leave_balances')
  loop
    execute format('alter table public.%I enable row level security', relation.tablename);
    execute format('drop policy if exists "Internal account access" on public.%I', relation.tablename);
    execute format('drop policy if exists "Require internal account" on public.%I', relation.tablename);
    execute format('create policy "Internal account access" on public.%I for all to authenticated using (public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'',''supervisor'',''employee''])) with check (public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'',''supervisor'',''employee'']))', relation.tablename);
    execute format('create policy "Require internal account" on public.%I as restrictive for all to authenticated using (public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'',''supervisor'',''employee''])) with check (public.hris_has_role(array[''hr_admin'',''general_manager'',''accounting_finance'',''supervisor'',''employee'']))', relation.tablename);
  end loop;
end; $$;

commit;
