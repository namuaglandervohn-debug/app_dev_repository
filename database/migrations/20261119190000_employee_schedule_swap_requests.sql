begin;

create table public.schedule_swap_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique default ('SWAP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  requester_employee_id text not null references public.employees(employee_id) on delete cascade,
  recipient_employee_id text not null references public.employees(employee_id) on delete cascade,
  requester_schedule_id text not null references public.schedule(schedule_id) on delete cascade,
  recipient_schedule_id text not null references public.schedule(schedule_id) on delete cascade,
  swap_day text not null check (swap_day in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  week text not null,
  requester_outlet text,
  recipient_outlet text,
  requester_shift text not null,
  recipient_shift text not null,
  reason text not null default '',
  status text not null default 'Pending Coworker'
    check (status in ('Pending Coworker','Pending HR','Approved','Rejected','Cancelled')),
  recipient_accepted boolean,
  recipient_note text,
  recipient_responded_at timestamptz,
  hr_user_id uuid,
  hr_note text,
  hr_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_swap_distinct_employees check (requester_employee_id <> recipient_employee_id),
  constraint schedule_swap_distinct_schedules check (requester_schedule_id <> recipient_schedule_id)
);

create index schedule_swap_requester_status_idx on public.schedule_swap_requests(requester_employee_id, status);
create index schedule_swap_recipient_status_idx on public.schedule_swap_requests(recipient_employee_id, status);

alter table public.schedule_swap_requests enable row level security;
revoke all on public.schedule_swap_requests from anon, authenticated;
grant select on public.schedule_swap_requests to authenticated;

create policy "Participants and HR can read schedule swap requests"
  on public.schedule_swap_requests for select to authenticated
  using (
    (select public.hris_has_role(array['hr_admin']))
    or hris_private.is_own_employee(requester_employee_id)
    or hris_private.is_own_employee(recipient_employee_id)
  );

create or replace function hris_private.is_valid_schedule_swap_update(
  old_row public.schedule,
  new_row public.schedule
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  swap public.schedule_swap_requests%rowtype;
  request_id_setting text;
  old_shift text;
  new_shift text;
begin
  if not public.hris_has_role(array['hr_admin']) then return false; end if;
  request_id_setting := nullif(current_setting('hris.schedule_swap_request_id', true), '');
  if request_id_setting is null or request_id_setting !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;

  select * into swap
  from public.schedule_swap_requests
  where id = request_id_setting::uuid
    and status = 'Pending HR'
    and recipient_accepted is true
    and hr_user_id = auth.uid();
  if not found then return false; end if;

  old_shift := to_jsonb(old_row) ->> swap.swap_day;
  new_shift := to_jsonb(new_row) ->> swap.swap_day;
  if to_jsonb(new_row) - array[swap.swap_day] <> to_jsonb(old_row) - array[swap.swap_day] then return false; end if;

  if old_row.schedule_id = swap.requester_schedule_id
     and old_row.employee_id = swap.requester_employee_id
     and coalesce(old_shift, '') = swap.requester_shift
     and coalesce(new_shift, '') = swap.recipient_shift then
    return true;
  end if;
  if old_row.schedule_id = swap.recipient_schedule_id
     and old_row.employee_id = swap.recipient_employee_id
     and coalesce(old_shift, '') = swap.recipient_shift
     and coalesce(new_shift, '') = swap.requester_shift then
    return true;
  end if;
  return false;
end;
$$;
revoke all on function hris_private.is_valid_schedule_swap_update(public.schedule, public.schedule) from public, anon, authenticated;

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
  day_name text := lower(btrim(coalesce(p_swap_day, '')));
  new_request_id uuid;
begin
  if auth.uid() is null or not public.hris_has_role(array['employee']) then
    raise exception 'Only employees can request a schedule swap' using errcode = '42501';
  end if;
  if p_recipient_employee_id is null or p_recipient_schedule_id is null or p_requester_schedule_id is null then
    raise exception 'Select a coworker and both schedules for the swap';
  end if;
  if day_name not in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday') then
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
  if requester_schedule.week is null or requester_schedule.week is distinct from recipient_schedule.week then
    raise exception 'Both employees must have schedules for the same week';
  end if;
  if requester_schedule.status not in ('Published','Confirmed') or recipient_schedule.status not in ('Published','Confirmed') then
    raise exception 'Only published or confirmed schedules can be swapped';
  end if;

  requester_shift := to_jsonb(requester_schedule) ->> day_name;
  recipient_shift := to_jsonb(recipient_schedule) ->> day_name;
  if coalesce(btrim(requester_shift), '') = '' or coalesce(btrim(recipient_shift), '') = ''
     or lower(btrim(requester_shift)) in ('off','rd','rest day')
     or lower(btrim(recipient_shift)) in ('off','rd','rest day') then
    raise exception 'Both employees must have a working shift on the selected day';
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
    day_name, requester_schedule.week, requester_schedule.outlet, recipient_schedule.outlet,
    requester_shift, recipient_shift, btrim(coalesce(p_reason, ''))
  ) returning id into new_request_id;
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
declare
  swap public.schedule_swap_requests%rowtype;
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
      recipient_note = nullif(btrim(coalesce(p_note, '')), ''),
      recipient_responded_at = now(),
      status = case when p_accept then 'Pending HR' else 'Rejected' end,
      updated_at = now()
  where id = p_request_id;
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
    set status = 'Rejected', hr_user_id = auth.uid(), hr_note = nullif(btrim(coalesce(p_note, '')), ''), hr_reviewed_at = now(), updated_at = now()
    where id = p_request_id;
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

  update public.schedule_swap_requests
  set hr_user_id = auth.uid(), hr_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_request_id;
  perform set_config('hris.schedule_swap_request_id', p_request_id::text, true);
  execute format(
    'update public.schedule set %I = case when schedule_id = $1 then $2 else $3 end where schedule_id in ($1, $4)',
    swap.swap_day
  ) using swap.requester_schedule_id, swap.recipient_shift, swap.requester_shift, swap.recipient_schedule_id;
  get diagnostics changed_rows = row_count;
  if changed_rows <> 2 then raise exception 'The swap could not update both schedules'; end if;

  update public.schedule_swap_requests
  set status = 'Approved', hr_reviewed_at = now(), updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.submit_schedule_swap_request(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.respond_to_schedule_swap_request(uuid,boolean,text) from public, anon, authenticated;
revoke all on function public.review_schedule_swap_request(uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.submit_schedule_swap_request(text,text,text,text,text) to authenticated;
grant execute on function public.respond_to_schedule_swap_request(uuid,boolean,text) to authenticated;
grant execute on function public.review_schedule_swap_request(uuid,boolean,text) to authenticated;

create or replace function hris_private.enforce_schedule_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;

  if public.hris_has_role(array['supervisor']) then
    if TG_OP = 'DELETE' then
      return OLD;
    elsif TG_OP = 'INSERT' then
      if coalesce(NEW.status, '') <> 'Draft' then
        raise exception 'Supervisors must save new schedules as drafts for HR validation';
      end if;
      NEW.created_by := auth.uid();
      NEW.validated_by := null;
      NEW.validated_at := null;
      return NEW;
    elsif TG_OP = 'UPDATE' then
      if coalesce(NEW.status, '') <> 'Draft' then
        raise exception 'Supervisors can edit schedules, but only HR can validate and publish them';
      end if;
      NEW.created_by := coalesce(OLD.created_by, auth.uid());
      NEW.validated_by := null;
      NEW.validated_at := null;
      return NEW;
    end if;
  end if;

  if public.hris_has_role(array['hr_admin']) then
    if TG_OP = 'UPDATE'
       and OLD.status = 'Draft'
       and NEW.status = 'Published'
       and OLD.created_by is not null
       and (to_jsonb(NEW) - array['status','validated_by','validated_at'])
           is not distinct from
           (to_jsonb(OLD) - array['status','validated_by','validated_at']) then
      NEW.validated_by := auth.uid();
      NEW.validated_at := now();
      return NEW;
    end if;
    if TG_OP = 'UPDATE' and hris_private.is_valid_schedule_swap_update(OLD, NEW) then
      return NEW;
    end if;
    raise exception 'HR can only validate and publish draft schedules or confirm an accepted schedule swap';
  end if;

  if public.hris_has_role(array['employee'])
     and TG_OP = 'UPDATE'
     and OLD.status = 'Published'
     and NEW.status in ('Confirmed','Declined')
     and (to_jsonb(NEW) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at'])
         is not distinct from
         (to_jsonb(OLD) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at']) then
    return NEW;
  end if;

  raise exception 'Your role is not allowed to create, edit, validate, or delete this schedule';
end;
$$;

revoke all on function hris_private.enforce_schedule_workflow() from public, anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
