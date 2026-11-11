-- Run as the database owner after applying the recruitment migrations.
-- The inner block rolls back every fixture even when all assertions pass.
do $test$
declare
  applicant uuid := gen_random_uuid();
  hr uuid := gen_random_uuid();
  gm uuid := gen_random_uuid();
  fixture_email text := applicant::text || '@example.test';
  application_id text;
  another_id text;
  rejected_id text;
  documents jsonb := '[{"name":"test.pdf","type":"application/pdf","data":"data:application/pdf;base64,JVBERg=="}]';
  payload jsonb := '{"name":"Test Applicant","first_name":"Test","last_name":"Applicant","suffix":"","cover_letter":"","position_applied":"Test role"}';
begin
  begin
    insert into public.job_postings (title) values ('Test role');
    insert into public.employees (employee_id, applicant_id, first_name, last_name)
    values ('TEST-' || applicant::text, 'APP-' || to_char(now(), 'YYYY') || '-900000000', 'Historical', 'Employee');
    insert into auth.users (id,email,raw_user_meta_data) values
      (applicant,fixture_email,'{"registration_kind":"applicant","applicant_profile":{"firstName":"Test","lastName":"Applicant","birthdate":"2000-01-01"}}'),
      (hr,hr::text || '@example.test','{}'),
      (gm,gm::text || '@example.test','{}');
    insert into public.user_accounts(user_id,auth_user_id,email,role,is_active) values
      (hr::text,hr,hr::text || '@example.test','hr_admin',true),
      (gm::text,gm,gm::text || '@example.test','general_manager',true);

    set local role authenticated;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant,'email',fixture_email,'role','authenticated')::text,true);
    application_id := public.submit_profile_application(payload);
    if substring(application_id from '[0-9]+$')::bigint <= 900000000 then
      raise exception 'Tracking ID allocator reused a reserved ID';
    end if;
    another_id := public.submit_profile_application(payload);
    rejected_id := public.submit_profile_application(payload);

    perform set_config('request.jwt.claims',jsonb_build_object('sub',hr,'email',hr::text || '@example.test','role','authenticated')::text,true);
    if not exists(select 1 from public.notifications where recipient_role='hr' and title='Application Received' and message like application_id || '%') then raise exception 'Missing HR notification'; end if;
    update public.applicants set status='Missing Requirements' where applicant_id=application_id;
    begin
      update public.applicants set status='Hired',hiring_decision='Hired' where applicant_id=application_id;
      raise exception 'HR was able to hire';
    exception when insufficient_privilege then null;
    end;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',applicant,'email',fixture_email,'role','authenticated')::text,true);
    begin
      perform public.resubmit_application_requirements(another_id,documents);
      raise exception 'Resubmission was accepted outside Missing Requirements';
    exception when insufficient_privilege then null;
    end;
    perform public.resubmit_application_requirements(application_id,documents);
    if not exists(select 1 from public.applicants where applicant_id=application_id and status='Under Review' and supporting_document_files @> documents) then raise exception 'Missing resubmission'; end if;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',hr,'email',hr::text || '@example.test','role','authenticated')::text,true);
    if not exists(select 1 from public.notifications where recipient_role='hr' and title='Additional Requirements Received' and message like application_id || '%') then raise exception 'Missing HR resubmission notification'; end if;
    begin
      update public.applicants set status='For Interview',interview_date='2026-12-01',interview_time='09:00',interview_location='Office' where applicant_id=application_id;
      raise exception 'Incomplete requirements allowed interview';
    exception when insufficient_privilege then null;
    end;
    update public.applicants set status='Under Review',has_resume=true,has_birth_cert=true,has_tor=true,has_med_cert=true
      where applicant_id in (application_id,another_id,rejected_id);
    update public.applicants set status='Not Qualified' where applicant_id=rejected_id;
    update public.applicants set status='For Interview',interview_date='2026-12-01',interview_time='09:00',interview_location='Office'
      where applicant_id in (application_id,another_id);
    begin
      update public.applicants set status='Hired',hiring_decision='Hired' where applicant_id=application_id;
      raise exception 'HR was able to record the final decision';
    exception when insufficient_privilege then null;
    end;

    perform set_config('request.jwt.claims',jsonb_build_object('sub',gm,'email',gm::text || '@example.test','role','authenticated')::text,true);
    if not exists(select 1 from public.notifications where recipient_role='gm' and title='Applicant Interview Scheduled' and message like application_id || '%') then raise exception 'Missing GM interview notification'; end if;
    update public.applicants set status='Not Hired',hiring_decision='Not Hired' where applicant_id=another_id;
    if exists(select 1 from public.employees where applicant_id=another_id) then raise exception 'Rejected applicant was forwarded'; end if;
    update public.applicants set status='Hired',hiring_decision='Hired' where applicant_id=application_id;
    if not exists(select 1 from public.employees e join public.user_accounts a using (employee_id)
      where e.applicant_id=application_id and a.auth_user_id=applicant and a.role='employee') then
      raise exception 'Missing employee or converted account';
    end if;
    reset role;
    raise sqlstate 'P9001';
  exception when sqlstate 'P9001' then null;
  end;
end;
$test$;
