begin;

-- Give employees a schedule-only view of published shifts in the outlets/weeks
-- where they are assigned. This deliberately returns no contact or private HR data.
create or replace function public.get_employee_schedule_overview()
returns table (
  schedule_id text,
  employee_id text,
  employee_name text,
  position text,
  outlet text,
  week text,
  time_in text,
  time_out text,
  break_time text,
  monday text,
  tuesday text,
  wednesday text,
  thursday text,
  friday text,
  saturday text,
  sunday text,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.hris_has_role(array['employee']) then
    raise exception 'Only employees can view the employee schedule overview' using errcode = '42501';
  end if;

  return query
  with me as (
    select e.employee_id, coalesce(nullif(ua.outlet, ''), nullif(e.outlet, '')) as home_outlet
    from public.employees e
    join public.user_accounts ua on ua.employee_id = e.employee_id
    where hris_private.is_own_employee(e.employee_id)
    limit 1
  )
  select s.schedule_id, s.employee_id,
    pg_catalog.btrim(pg_catalog.concat_ws(' ', e.first_name, e.middle_name, e.last_name, e.suffix)),
    coalesce(nullif(s.position, ''), e.position, ''),
    coalesce(nullif(s.outlet, ''), e.outlet, ''),
    s.week, coalesce(s.time_in::text, ''), coalesce(s.time_out::text, ''), coalesce(s.break_time::text, ''),
    coalesce(s.monday, ''), coalesce(s.tuesday, ''), coalesce(s.wednesday, ''), coalesce(s.thursday, ''),
    coalesce(s.friday, ''), coalesce(s.saturday, ''), coalesce(s.sunday, ''), s.status
  from public.schedule s
  join public.employees e on e.employee_id = s.employee_id
  cross join me
  where s.status in ('Published', 'Confirmed')
    and coalesce(e.status, 'Active') not in ('Resigned', 'Terminated')
    and (
      s.employee_id = me.employee_id
      or exists (
        select 1
        from public.schedule own_schedule
        where own_schedule.employee_id = me.employee_id
          and own_schedule.week = s.week
          and own_schedule.status in ('Published', 'Confirmed')
          and pg_catalog.lower(pg_catalog.btrim(coalesce(nullif(s.outlet, ''), e.outlet, '')))
              = pg_catalog.lower(pg_catalog.btrim(coalesce(nullif(own_schedule.outlet, ''), me.home_outlet, '')))
      )
    )
  order by s.week desc, coalesce(nullif(s.outlet, ''), e.outlet, ''), e.first_name, e.last_name;
end;
$$;
revoke all on function public.get_employee_schedule_overview() from public, anon;
grant execute on function public.get_employee_schedule_overview() to authenticated;

-- Swap-request participants can see names and the request details they need,
-- without broadening read access to employee profiles.
create or replace function public.list_schedule_swap_requests()
returns table (
  id uuid,
  request_id text,
  requester_employee_id text,
  recipient_employee_id text,
  requester_schedule_id text,
  recipient_schedule_id text,
  swap_day text,
  week text,
  requester_outlet text,
  recipient_outlet text,
  requester_shift text,
  recipient_shift text,
  reason text,
  status text,
  recipient_accepted boolean,
  recipient_note text,
  hr_note text,
  created_at timestamptz,
  requester_name text,
  recipient_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.hris_has_role(array['employee','hr_admin']) then
    raise exception 'You are not allowed to view schedule swap requests' using errcode = '42501';
  end if;

  return query
  select r.id, r.request_id, r.requester_employee_id, r.recipient_employee_id,
    r.requester_schedule_id, r.recipient_schedule_id, r.swap_day, r.week,
    r.requester_outlet, r.recipient_outlet, r.requester_shift, r.recipient_shift,
    r.reason, r.status, r.recipient_accepted, r.recipient_note, r.hr_note, r.created_at,
    pg_catalog.btrim(pg_catalog.concat_ws(' ', requester.first_name, requester.middle_name, requester.last_name, requester.suffix)),
    pg_catalog.btrim(pg_catalog.concat_ws(' ', recipient.first_name, recipient.middle_name, recipient.last_name, recipient.suffix))
  from public.schedule_swap_requests r
  join public.employees requester on requester.employee_id = r.requester_employee_id
  join public.employees recipient on recipient.employee_id = r.recipient_employee_id
  where public.hris_has_role(array['hr_admin'])
    or hris_private.is_own_employee(r.requester_employee_id)
    or hris_private.is_own_employee(r.recipient_employee_id)
  order by r.created_at desc;
end;
$$;
revoke all on function public.list_schedule_swap_requests() from public, anon;
grant execute on function public.list_schedule_swap_requests() to authenticated;

create or replace function hris_private.schedule_weekday_date(p_week text, p_day text)
returns date
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  base_week text := pg_catalog.split_part(coalesce(p_week, ''), ' | Special Duty: ', 1);
  start_date date;
  date_text text;
  parts text[];
  day_offset integer;
begin
  day_offset := case pg_catalog.lower(pg_catalog.btrim(coalesce(p_day, '')))
    when 'monday' then 0 when 'tuesday' then 1 when 'wednesday' then 2
    when 'thursday' then 3 when 'friday' then 4 when 'saturday' then 5 when 'sunday' then 6
    else null end;
  if day_offset is null then return null; end if;

  date_text := pg_catalog.substring(base_week from '([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})');
  if date_text is not null then
    start_date := pg_catalog.to_date(date_text, 'MM/DD/YYYY');
  else
    parts := pg_catalog.regexp_match(base_week, '^\s*([A-Za-z]+)\s+([0-9]{1,2})\s*(?:[-–—].*)?,\s*([0-9]{4})');
    if parts is not null then
      start_date := pg_catalog.to_date(parts[1] || ' ' || parts[2] || ' ' || parts[3], 'Month DD YYYY');
    end if;
  end if;
  if start_date is null then return null; end if;
  return start_date + day_offset;
exception when others then
  return null;
end;
$$;
revoke all on function hris_private.schedule_weekday_date(text,text) from public, anon, authenticated;

create or replace function public.submit_schedule_swap_request(
  p_recipient_employee_id text,
  p_requester_schedule_id text,
  p_recipient_schedule_id text,
  p_swap_day text,
  p_reason text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  requester_schedule public.schedule%rowtype;
  recipient_schedule public.schedule%rowtype;
  requester_shift text;
  recipient_shift text;
  requester_outlet text;
  recipient_outlet text;
  swap_date date;
  new_request_id uuid;
begin
  if auth.uid() is null or not public.hris_has_role(array['employee']) then
    raise exception 'Only employees can request a schedule swap' using errcode = '42501';
  end if;
  if p_recipient_employee_id is null or p_recipient_schedule_id is null or p_requester_schedule_id is null then
    raise exception 'Select a coworker and both schedules for the swap';
  end if;
  if pg_catalog.lower(pg_catalog.btrim(coalesce(p_swap_day, ''))) not in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') then
    raise exception 'Select a valid workday';
  end if;
  if not hris_private.is_own_employee((select s.employee_id from public.schedule s where s.schedule_id = p_requester_schedule_id)) then
    raise exception 'You can only request a swap for your own schedule' using errcode = '42501';
  end if;

  perform 1 from public.schedule s
  where s.schedule_id in (p_requester_schedule_id, p_recipient_schedule_id)
  order by s.schedule_id for update;
  select * into requester_schedule from public.schedule where schedule_id = p_requester_schedule_id;
  select * into recipient_schedule from public.schedule where schedule_id = p_recipient_schedule_id;
  if requester_schedule.schedule_id is null or recipient_schedule.schedule_id is null then
    raise exception 'One of the selected schedules no longer exists';
  end if;
  if requester_schedule.employee_id is null
     or requester_schedule.employee_id = recipient_schedule.employee_id
     or recipient_schedule.employee_id is distinct from p_recipient_employee_id then
    raise exception 'The selected schedules do not belong to the requester and coworker';
  end if;
  select coalesce(nullif(e.outlet, ''), '') into requester_outlet
  from public.employees e where e.employee_id = requester_schedule.employee_id;
  select coalesce(nullif(e.outlet, ''), '') into recipient_outlet
  from public.employees e where e.employee_id = recipient_schedule.employee_id;
  requester_outlet := coalesce(nullif(requester_schedule.outlet, ''), requester_outlet, '');
  recipient_outlet := coalesce(nullif(recipient_schedule.outlet, ''), recipient_outlet, '');
  if pg_catalog.lower(pg_catalog.btrim(requester_outlet)) is distinct from pg_catalog.lower(pg_catalog.btrim(recipient_outlet)) then
    raise exception 'Choose a coworker scheduled at the same outlet';
  end if;
  if requester_schedule.week is null or requester_schedule.week is distinct from recipient_schedule.week
     or requester_schedule.week ilike '%Special Duty:%' or recipient_schedule.week ilike '%Special Duty:%' then
    raise exception 'Both employees must have regular schedules for the same week';
  end if;
  if requester_schedule.status not in ('Published','Confirmed') or recipient_schedule.status not in ('Published','Confirmed') then
    raise exception 'Only published schedules can be swapped';
  end if;

  requester_shift := to_jsonb(requester_schedule) ->> pg_catalog.lower(pg_catalog.btrim(p_swap_day));
  recipient_shift := to_jsonb(recipient_schedule) ->> pg_catalog.lower(pg_catalog.btrim(p_swap_day));
  if coalesce(pg_catalog.btrim(requester_shift), '') = '' or coalesce(pg_catalog.btrim(recipient_shift), '') = ''
     or pg_catalog.lower(pg_catalog.btrim(requester_shift)) in ('off','rd','rest day')
     or pg_catalog.lower(pg_catalog.btrim(recipient_shift)) in ('off','rd','rest day') then
    raise exception 'Both employees must have a working shift on the selected day';
  end if;
  swap_date := hris_private.schedule_weekday_date(requester_schedule.week, p_swap_day);
  if swap_date is null then raise exception 'The schedule week cannot be read. Ask HR to correct the schedule dates.'; end if;

  if exists (
    select 1 from public.employee_requests r
    where r.employee_id in (requester_schedule.employee_id, recipient_schedule.employee_id)
      and r.request_type = 'Leave'
      and r.status = 'Approved'
      and r.start_date <= swap_date and r.end_date >= swap_date
  ) then
    raise exception 'A coworker has approved leave on this date, so the swap cannot be submitted';
  end if;
  if exists (
    select 1 from public.schedule other_schedule
    where other_schedule.employee_id in (requester_schedule.employee_id, recipient_schedule.employee_id)
      and other_schedule.schedule_id not in (p_requester_schedule_id, p_recipient_schedule_id)
      and other_schedule.week = requester_schedule.week
      and other_schedule.status in ('Published','Confirmed')
      and coalesce(to_jsonb(other_schedule) ->> pg_catalog.lower(pg_catalog.btrim(p_swap_day)), '') !~* '^(|off|rd|rest day)$'
  ) then
    raise exception 'A coworker already has another scheduled duty on this date';
  end if;
  if exists (
    select 1 from public.schedule_swap_requests r
    where r.status in ('Pending Coworker','Pending HR')
      and (r.requester_schedule_id in (p_requester_schedule_id, p_recipient_schedule_id)
        or r.recipient_schedule_id in (p_requester_schedule_id, p_recipient_schedule_id))
  ) then
    raise exception 'One of these schedules already has a pending swap request';
  end if;

  insert into public.schedule_swap_requests (
    requester_employee_id, recipient_employee_id, requester_schedule_id, recipient_schedule_id,
    swap_day, week, requester_outlet, recipient_outlet, requester_shift, recipient_shift, reason
  ) values (
    requester_schedule.employee_id, p_recipient_employee_id, p_requester_schedule_id, p_recipient_schedule_id,
    pg_catalog.lower(pg_catalog.btrim(p_swap_day)), requester_schedule.week, requester_schedule.outlet, recipient_schedule.outlet,
    requester_shift, recipient_shift, pg_catalog.btrim(coalesce(p_reason, ''))
  ) returning id into new_request_id;

  insert into public.notifications(recipient_employee_id, title, message, type)
  values (p_recipient_employee_id, 'Schedule swap request', 'A coworker asked to swap your ' || pg_catalog.initcap(p_swap_day) || ' shift. Review it in Requests.', 'schedule_swap');
  insert into public.notifications(recipient_role, title, message, type)
  values ('hr', 'Schedule swap awaiting coworker', 'A schedule swap request is waiting for the receiving employee to respond.', 'schedule_swap');
  return new_request_id;
end;
$$;

create or replace function public.respond_to_schedule_swap_request(
  p_request_id uuid,
  p_accept boolean,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare swap public.schedule_swap_requests%rowtype;
begin
  if auth.uid() is null or not public.hris_has_role(array['employee']) then
    raise exception 'Only the receiving employee can respond to this request' using errcode = '42501';
  end if;
  select * into swap from public.schedule_swap_requests where id = p_request_id for update;
  if not found or not hris_private.is_own_employee(swap.recipient_employee_id)
     or swap.requester_employee_id = swap.recipient_employee_id then
    raise exception 'You are not the receiving employee for this request' using errcode = '42501';
  end if;
  if swap.status <> 'Pending Coworker' then raise exception 'This request is no longer waiting for your response'; end if;

  update public.schedule_swap_requests
  set recipient_accepted = p_accept,
      recipient_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''),
      recipient_responded_at = pg_catalog.now(),
      status = case when p_accept then 'Pending HR' else 'Rejected' end,
      updated_at = pg_catalog.now()
  where id = p_request_id;

  if p_accept then
    insert into public.notifications(recipient_role, title, message, type)
    values ('hr', 'Schedule swap awaiting review', 'Both employees are ready for a schedule swap. HR approval is required before schedules change.', 'schedule_swap');
    insert into public.notifications(recipient_employee_id, title, message, type)
    values (swap.requester_employee_id, 'Schedule swap accepted', 'Your coworker accepted the swap. It is now waiting for HR approval.', 'schedule_swap');
  else
    insert into public.notifications(recipient_employee_id, title, message, type)
    values (swap.requester_employee_id, 'Schedule swap declined', 'Your coworker declined the schedule swap request.', 'schedule_swap');
  end if;
end;
$$;

create or replace function public.review_schedule_swap_request(
  p_request_id uuid,
  p_approve boolean,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  swap public.schedule_swap_requests%rowtype;
  requester_schedule public.schedule%rowtype;
  recipient_schedule public.schedule%rowtype;
  requester_shift text;
  recipient_shift text;
  swap_date date;
  changed_rows integer;
begin
  if auth.uid() is null or not public.hris_has_role(array['hr_admin']) then
    raise exception 'Only HR can review an accepted schedule swap' using errcode = '42501';
  end if;
  select * into swap from public.schedule_swap_requests where id = p_request_id for update;
  if not found or swap.status <> 'Pending HR' or swap.recipient_accepted is distinct from true then
    raise exception 'This request has not been accepted by the receiving employee';
  end if;
  if not p_approve then
    update public.schedule_swap_requests
    set status = 'Rejected', hr_user_id = auth.uid(), hr_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), ''), hr_reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
    where id = p_request_id;
    insert into public.notifications(recipient_employee_id, title, message, type)
    values (swap.requester_employee_id, 'Schedule swap rejected by HR', 'HR rejected the schedule swap request.', 'schedule_swap'),
      (swap.recipient_employee_id, 'Schedule swap rejected by HR', 'HR rejected the schedule swap request.', 'schedule_swap');
    return;
  end if;

  perform 1 from public.schedule s
  where s.schedule_id in (swap.requester_schedule_id, swap.recipient_schedule_id)
  order by s.schedule_id for update;
  select * into requester_schedule from public.schedule where schedule_id = swap.requester_schedule_id;
  select * into recipient_schedule from public.schedule where schedule_id = swap.recipient_schedule_id;
  if requester_schedule.employee_id is distinct from swap.requester_employee_id
     or recipient_schedule.employee_id is distinct from swap.recipient_employee_id
     or requester_schedule.week is distinct from swap.week
     or recipient_schedule.week is distinct from swap.week
     or requester_schedule.status not in ('Published','Confirmed')
     or recipient_schedule.status not in ('Published','Confirmed') then
    raise exception 'The schedules changed since this request was submitted. Refresh and review it again.';
  end if;
  requester_shift := to_jsonb(requester_schedule) ->> swap.swap_day;
  recipient_shift := to_jsonb(recipient_schedule) ->> swap.swap_day;
  if requester_shift is distinct from swap.requester_shift or recipient_shift is distinct from swap.recipient_shift then
    raise exception 'The selected shifts changed since this request was submitted. The swap was not applied.';
  end if;
  swap_date := hris_private.schedule_weekday_date(swap.week, swap.swap_day);
  if swap_date is null then raise exception 'The schedule week cannot be read. The swap was not applied.'; end if;
  if exists (
    select 1 from public.employee_requests r
    where r.employee_id in (swap.requester_employee_id, swap.recipient_employee_id)
      and r.request_type = 'Leave' and r.status = 'Approved'
      and r.start_date <= swap_date and r.end_date >= swap_date
  ) then
    raise exception 'A coworker has approved leave on this date. The swap was not applied.';
  end if;
  if exists (
    select 1 from public.schedule other_schedule
    where other_schedule.employee_id in (swap.requester_employee_id, swap.recipient_employee_id)
      and other_schedule.schedule_id not in (swap.requester_schedule_id, swap.recipient_schedule_id)
      and other_schedule.week = swap.week
      and other_schedule.status in ('Published','Confirmed')
      and coalesce(to_jsonb(other_schedule) ->> swap.swap_day, '') !~* '^(|off|rd|rest day)$'
  ) then
    raise exception 'A coworker already has another scheduled duty on this date. The swap was not applied.';
  end if;

  update public.schedule_swap_requests
  set hr_user_id = auth.uid(), hr_note = nullif(pg_catalog.btrim(coalesce(p_note, '')), '')
  where id = p_request_id;
  perform pg_catalog.set_config('hris.schedule_swap_request_id', p_request_id::text, true);
  execute pg_catalog.format(
    'update public.schedule set %I = case when schedule_id = $1 then $2 else $3 end where schedule_id in ($1, $4)',
    swap.swap_day
  ) using swap.requester_schedule_id, swap.recipient_shift, swap.requester_shift, swap.recipient_schedule_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 2 then raise exception 'The swap could not update both schedules'; end if;

  update public.schedule_swap_requests
  set status = 'Approved', hr_reviewed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where id = p_request_id;
  insert into public.notifications(recipient_employee_id, title, message, type)
  values (swap.requester_employee_id, 'Schedule swap approved', 'HR approved the schedule swap. Your published schedule has been updated.', 'schedule_swap'),
    (swap.recipient_employee_id, 'Schedule swap approved', 'HR approved the schedule swap. Your published schedule has been updated.', 'schedule_swap');
end;
$$;

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule') then
      alter publication supabase_realtime add table public.schedule;
    end if;
    if not exists (select 1 from pg_catalog.pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'schedule_swap_requests') then
      alter publication supabase_realtime add table public.schedule_swap_requests;
    end if;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
