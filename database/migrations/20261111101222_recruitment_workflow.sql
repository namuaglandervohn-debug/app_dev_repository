create or replace function public.guard_recruitment_workflow()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  hr boolean;
  gm boolean;
  complete boolean;
begin
  -- Trusted database operations and the applicant resubmission function use
  -- their own authorization. Interactive staff updates run as authenticated.
  if current_user <> 'authenticated' then return new; end if;

  hr := public.hris_has_role(array['hr_admin']);
  gm := public.hris_has_role(array['general_manager']);
  if (new.is_archived is distinct from old.is_archived and not (hr or gm))
    or (old.is_archived and new.is_archived and new.status is distinct from old.status) then
    raise exception 'Archived applications cannot advance.' using errcode = '42501';
  end if;
  complete := coalesce(new.has_resume and new.has_birth_cert and new.has_tor and new.has_med_cert, false)
    and not exists (
      select 1 from jsonb_array_elements(coalesce(new.custom_requirements, '[]'::jsonb)) as item
      where item->'checked' is distinct from 'true'::jsonb
    );

  if row(new.interview_feedback, new.hiring_decision) is distinct from row(old.interview_feedback, old.hiring_decision)
    and not (gm and old.status = 'For Interview' and new.status in ('Hired', 'Not Hired')) then
    raise exception 'Only the General Manager can record a final interview decision.' using errcode = '42501';
  end if;

  if row(new.interview_date, new.interview_time, new.interview_location, new.interview_notes, new.scheduled_by)
    is distinct from row(old.interview_date, old.interview_time, old.interview_location, old.interview_notes, old.scheduled_by)
    and not (hr and new.status = 'For Interview') then
    raise exception 'Only HR can schedule an interview.' using errcode = '42501';
  end if;

  if row(new.has_resume, new.has_birth_cert, new.has_tor, new.has_med_cert, new.custom_requirements)
    is distinct from row(old.has_resume, old.has_birth_cert, old.has_tor, old.has_med_cert, old.custom_requirements)
    and not (hr and old.status in ('Submitted', 'Under Review', 'Missing Requirements')
      and new.status in ('Under Review', 'Missing Requirements')) then
    raise exception 'Only HR can review requirements during screening.' using errcode = '42501';
  end if;

  if new.status = old.status and new.status <> 'For Interview' then return new; end if;
  if new.status = 'For Interview' then
    if new.status = old.status
      and row(new.interview_date, new.interview_time, new.interview_location, new.interview_notes, new.scheduled_by)
        is not distinct from row(old.interview_date, old.interview_time, old.interview_location, old.interview_notes, old.scheduled_by) then
      return new;
    end if;
    if hr and (old.status = 'For Interview' or (old.status = 'Under Review' and complete))
      and nullif(btrim(new.interview_date), '') is not null and new.interview_time is not null
      and nullif(btrim(new.interview_location), '') is not null then
      return new;
    end if;
  elsif hr and (
    (old.status = 'Submitted' and new.status = 'Under Review')
    or (old.status in ('Submitted', 'Under Review', 'Missing Requirements') and new.status = 'Missing Requirements' and not complete)
    or (old.status = 'Missing Requirements' and new.status = 'Under Review' and complete)
    or (old.status = 'Under Review' and new.status = 'Not Qualified' and complete)
  ) then
    return new;
  elsif (hr or gm) and (new.status = 'Archived' or (old.status = 'Archived' and new.status = 'Submitted')) then
    return new;
  elsif gm and old.status = 'For Interview' and new.status in ('Hired', 'Not Hired')
    and new.hiring_decision = new.status
    and nullif(btrim(old.interview_date), '') is not null and old.interview_time is not null
    and nullif(btrim(old.interview_location), '') is not null then
    return new;
  end if;
  raise exception 'This status change is unavailable at the current recruitment stage.' using errcode = '42501';
end;
$$;

drop trigger if exists guard_recruitment_workflow on public.applicants;
create trigger guard_recruitment_workflow
before update on public.applicants
for each row execute function public.guard_recruitment_workflow();

create or replace function public.notify_recruitment_staff()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'Submitted' then
    insert into public.notifications (recipient_role, title, message, type)
    values ('hr', 'Application Received', format('%s was submitted for %s.', new.applicant_id, new.position_applied), 'application');
  elsif tg_op = 'UPDATE' and new.status = 'For Interview' and old.status is distinct from new.status then
    insert into public.notifications (recipient_role, title, message, type)
    values ('gm', 'Applicant Interview Scheduled', format('%s is ready for a General Manager interview.', new.applicant_id), 'application');
  end if;
  return new;
end;
$$;

drop trigger if exists notify_recruitment_staff on public.applicants;
create trigger notify_recruitment_staff
after insert or update of status on public.applicants
for each row execute function public.notify_recruitment_staff();

create or replace function public.resubmit_application_requirements(p_applicant_id text, p_files jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  document jsonb;
  mime text;
begin
  if owner_id is null or not exists (
    select 1 from public.applicant_profiles where auth_user_id = owner_id
  ) then
    raise exception 'Sign in with your applicant account to submit requirements.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'Select supporting documents to upload.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_files) not between 1 and 5 or octet_length(p_files::text) > 14000000 then
    raise exception 'Upload one to five files, up to 10 MB total.' using errcode = '22023';
  end if;

  for document in select value from jsonb_array_elements(p_files) loop
    mime := document->>'type';
    if nullif(btrim(document->>'name'), '') is null or length(document->>'name') > 255
      or mime is null or mime not in ('application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png')
      or left(coalesce(document->>'data', ''), length(mime) + 13) <> 'data:' || mime || ';base64,'
      or length(document->>'data') <= length(mime) + 13 then
      raise exception 'Use PDF, Word, JPG, or PNG documents.' using errcode = '22023';
    end if;
  end loop;

  update public.applicants
  set supporting_documents = coalesce(supporting_documents, '[]'::jsonb)
        || (select jsonb_agg(file->>'name') from jsonb_array_elements(p_files) file),
      supporting_document_files = coalesce(supporting_document_files, '[]'::jsonb) || p_files,
      status = 'Under Review',
      updated_at = now()
  where applicant_id = p_applicant_id and auth_user_id = owner_id
    and status = 'Missing Requirements' and not is_archived;

  if not found then
    raise exception 'This application is unavailable for resubmission.' using errcode = '42501';
  end if;
  insert into public.notifications (recipient_role, title, message, type)
  values ('hr', 'Additional Requirements Received', format('%s submitted additional documents for review.', p_applicant_id), 'application');
end;
$$;

revoke all on function public.guard_recruitment_workflow() from public, anon, authenticated;
revoke all on function public.notify_recruitment_staff() from public, anon, authenticated;
revoke all on function public.resubmit_application_requirements(text, jsonb) from public, anon, authenticated;
grant execute on function public.resubmit_application_requirements(text, jsonb) to authenticated;

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

  if new.auth_user_id is not null and auth.uid() is not null then
    perform public.convert_applicant_account(new.applicant_id, employee_code);
  end if;
  return new;
end;
$$;

drop trigger if exists forward_hired_applicant on public.applicants;
create trigger forward_hired_applicant
after update of status on public.applicants
for each row when (new.status = 'Hired' and old.status is distinct from new.status)
execute function public.forward_hired_applicant();

revoke all on function public.forward_hired_applicant() from public, anon, authenticated;
