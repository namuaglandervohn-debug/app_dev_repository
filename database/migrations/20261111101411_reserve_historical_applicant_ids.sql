create or replace function public.submit_profile_application(p_application jsonb)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  next_number bigint;
  tracking_id text;
  allowed jsonb;
  year_prefix text := 'APP-' || to_char(now(), 'YYYY') || '-';
begin
  if auth.uid() is null or not exists (select 1 from public.applicant_profiles where auth_user_id = auth.uid()) then
    raise exception 'Please register and sign in before applying.';
  end if;
  if exists (select 1 from public.user_accounts where auth_user_id = auth.uid()) then
    raise exception 'This login is already an employee account.';
  end if;
  if not exists (
    select 1 from public.job_postings
    where is_active is true and btrim(title) = btrim(p_application->>'position_applied')
  ) then
    raise exception 'This position is no longer open. Please choose an active posting.';
  end if;

  perform pg_advisory_xact_lock(778812);
  select coalesce(max(substring(applicant_id from '[0-9]+$')::bigint), 0) + 1 into next_number
  from (
    select applicant_id from public.applicants
    union all
    select applicant_id from public.employees
  ) as reserved
  where applicant_id ~ ('^' || year_prefix || '[0-9]{4,12}$');
  tracking_id := year_prefix || lpad(next_number::text, greatest(4, length(next_number::text)), '0');

  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into allowed from jsonb_each(p_application)
  where key = any(array['name','first_name','middle_name','last_name','suffix','gender','civil_status','birthdate','birthplace','height','weight','phone_number','address','position_applied','education','experience','cover_letter','tin','sss','philhealth','pagibig','emergency_contact','resume_file_name','resume_file_data','supporting_documents','supporting_document_files']);
  insert into public.applicants select * from jsonb_populate_record(null::public.applicants,
    allowed || jsonb_build_object('id',gen_random_uuid(),'applicant_id',tracking_id,'auth_user_id',auth.uid(),'email',auth.jwt()->>'email','status','Submitted','created_at',now(),'updated_at',now(),'is_archived',false,'has_resume',false,'has_birth_cert',false,'has_tor',false,'has_med_cert',false));
  return tracking_id;
end;
$$;

create or replace function public.notify_recruitment_staff()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.employees where applicant_id = new.applicant_id) then
      raise exception 'This applicant ID is reserved for an existing employee.' using errcode = '23505';
    end if;
    if new.status = 'Submitted' then
      insert into public.notifications (recipient_role, title, message, type)
      values ('hr', 'Application Received', format('%s was submitted for %s.', new.applicant_id, new.position_applied), 'application');
    end if;
  elsif new.status = 'For Interview' and old.status is distinct from new.status then
    insert into public.notifications (recipient_role, title, message, type)
    values ('gm', 'Applicant Interview Scheduled', format('%s is ready for a General Manager interview.', new.applicant_id), 'application');
  end if;
  return new;
end;
$$;
