-- Run after the migration inside a transaction, then ROLLBACK.
-- Synthetic records only: no messages, password changes, or retained test users.
insert into auth.users(id,aud,role,email,encrypted_password,raw_user_meta_data,created_at,updated_at)
values ('c0010000-0000-4000-8000-000000000001','authenticated','authenticated','profile-fixture@example.invalid','unchanged-fixture-hash',
  '{"registration_kind":"applicant","applicant_profile":{"firstName":"Test","lastName":"Applicant","birthdate":"1995-01-01","contactNumber":"9123456789"}}',now(),now());
insert into auth.users(id,aud,role,email,encrypted_password,raw_user_meta_data,created_at,updated_at)
values ('c0010000-0000-4000-8000-000000000002','authenticated','authenticated','other-fixture@example.invalid','unchanged-fixture-hash',
  '{"registration_kind":"applicant","applicant_profile":{"firstName":"Other","lastName":"Applicant","birthdate":"1996-01-01"}}',now(),now());
select set_config('test.hr_auth', (select auth_user_id::text from public.user_accounts where role='hr_admin' and is_active=true and auth_user_id is not null limit 1),true);
select set_config('request.jwt.claims','{"sub":"c0010000-0000-4000-8000-000000000001","role":"authenticated","email":"profile-fixture@example.invalid"}',true);
set local role authenticated;
do $$ declare app_id text; second_id text; affected integer; begin
  if (select count(*) from public.applicant_profiles) <> 1 then raise exception 'Applicant profile isolation failed'; end if;
  if exists(select 1 from public.employees) then raise exception 'Applicant can read internal employee data'; end if;
  if exists(select 1 from public.user_accounts) then raise exception 'Applicant can read internal accounts'; end if;
  begin
    insert into public.leave_types(name) values('__UNAUTHORIZED_TEST__');
    raise exception 'Applicant was allowed to create a leave type';
  exception when insufficient_privilege then null; end;
  app_id := public.submit_profile_application('{"first_name":"Test","last_name":"Applicant","suffix":"","name":"Test Applicant","cover_letter":"{}","position_applied":"Service Crew","status":"Hired"}');
  second_id := public.submit_profile_application('{"first_name":"Test","last_name":"Applicant","suffix":"","name":"Test Applicant","cover_letter":"{}","position_applied":"Cashier"}');
  if substring(second_id from '[0-9]+$')::bigint <> substring(app_id from '[0-9]+$')::bigint+1 then raise exception 'Sequential applicant IDs failed'; end if;
  if (select count(*) from public.applicants) <> 2 then raise exception 'Application isolation failed'; end if;
  if exists(select 1 from public.applicants where status <> 'Submitted') then raise exception 'Applicant supplied a privileged status'; end if;
  update public.applicant_profiles set profile=profile || '{"firstName":"Changed"}' where auth_user_id=auth.uid();
  if exists(select 1 from public.applicants where first_name <> 'Test') then raise exception 'A profile update rewrote application history'; end if;
  begin
    perform public.convert_applicant_account(app_id,'EMP-TEST-PROFILE');
    raise exception 'Applicant was allowed to convert their own account';
  exception when raise_exception then
    if sqlerrm not like 'Only HR/Admin%' then raise; end if;
  end;
  perform set_config('test.applicant_id',app_id,true);
end; $$;
reset role;
update public.applicants set status='Hired' where applicant_id=current_setting('test.applicant_id');
insert into public.employees(employee_id,applicant_id,first_name,last_name,email,status)
values('EMP-TEST-PROFILE',current_setting('test.applicant_id'),'Test','Applicant','profile-fixture@example.invalid','Active');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hr_auth'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare result jsonb; begin
  result := public.convert_applicant_account(current_setting('test.applicant_id'),'EMP-TEST-PROFILE');
  if result->>'auth_user_id' <> 'c0010000-0000-4000-8000-000000000001' then raise exception 'Conversion replaced the applicant identity'; end if;
  perform public.convert_applicant_account(current_setting('test.applicant_id'),'EMP-TEST-PROFILE');
  if (select count(*) from public.user_accounts where employee_id='EMP-TEST-PROFILE') <> 1 then raise exception 'Conversion created a duplicate account'; end if;
  insert into public.leave_types(name) values('__Wellness fixture__');
end; $$;
select set_config('request.jwt.claims','{"sub":"c0010000-0000-4000-8000-000000000001","role":"authenticated","email":"profile-fixture@example.invalid"}',true);
do $$ begin
  insert into public.employee_requests(employee_id,request_type,leave_type,start_date,end_date,reason)
  values('EMP-TEST-PROFILE','Leave','__Wellness fixture__',current_date,current_date,'Database fixture');
  begin
    insert into public.leave_types(name) values('__EMPLOYEE_UNAUTHORIZED_TEST__');
    raise exception 'Employee was allowed to manage leave types';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.hr_auth'),'role','authenticated')::text,true);
update public.leave_types set is_active=false where name='__Wellness fixture__';
-- Existing requests still support normal review after a type is deactivated.
update public.employee_requests set status='Approved' where employee_id='EMP-TEST-PROFILE';
select set_config('request.jwt.claims','{"sub":"c0010000-0000-4000-8000-000000000001","role":"authenticated","email":"profile-fixture@example.invalid"}',true);
do $$ begin
  begin
    insert into public.employee_requests(employee_id,request_type,leave_type,start_date,end_date,reason)
    values('EMP-TEST-PROFILE','Leave','__Wellness fixture__',current_date,current_date,'Must fail');
    raise exception 'A deactivated leave type was accepted';
  exception when raise_exception then
    if sqlerrm not like 'This leave type is no longer available%' then raise; end if;
  end;
end; $$;
reset role;
do $$ begin
  if (select encrypted_password from auth.users where id='c0010000-0000-4000-8000-000000000001') <> 'unchanged-fixture-hash' then raise exception 'Conversion changed the password'; end if;
end; $$;
select 'PASS: profile isolation, application snapshots, sequential IDs, conversion, leave permissions and deactivation' as verification;
