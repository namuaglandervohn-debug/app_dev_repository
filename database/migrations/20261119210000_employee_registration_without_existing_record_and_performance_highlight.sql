begin;

alter table public.employee_account_requests
  add column if not exists requested_outlet text;

create or replace function public.register_employee_account_request()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_employee_id text;
  requested_full_name text;
  requested_outlet text;
  normalized_email text;
  matched_employee public.employees;
  employee_name text;
begin
  if coalesce(new.raw_user_meta_data->>'registration_kind', '') <> 'employee' then
    return new;
  end if;

  requested_employee_id := nullif(btrim(new.raw_user_meta_data->>'employee_id'), '');
  requested_full_name := nullif(regexp_replace(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), '\s+', ' ', 'g'), '');
  requested_outlet := nullif(btrim(new.raw_user_meta_data->>'outlet'), '');
  normalized_email := lower(btrim(coalesce(new.email, '')));

  if requested_employee_id is null or requested_full_name is null
     or cardinality(regexp_split_to_array(requested_full_name, '\s+')) < 2
     or normalized_email = '' or requested_outlet is null then
    raise exception 'Enter your full name, employee ID, email address, and assigned outlet.';
  end if;
  if requested_outlet not in ('Maria Clara Restaurant', 'Maria Clara Resort', 'Buenaventura Café') then
    raise exception 'Select a valid assigned outlet.';
  end if;

  -- Lock the normalized ID so case-only or simultaneous duplicate claims cannot pass.
  perform pg_advisory_xact_lock(
    hashtext('employee-account-registration'),
    hashtext(upper(requested_employee_id))
  );

  select * into matched_employee
  from public.employees
  where upper(btrim(employee_id)) = upper(requested_employee_id)
  limit 1
  for share;

  if found then
    employee_name := concat_ws(' ', nullif(btrim(matched_employee.first_name), ''),
      nullif(btrim(matched_employee.middle_name), ''), nullif(btrim(matched_employee.last_name), ''),
      nullif(btrim(matched_employee.suffix), ''));
    requested_employee_id := matched_employee.employee_id;
  else
    employee_name := requested_full_name;
  end if;
  if exists (select 1 from public.user_accounts where upper(btrim(employee_id)) = upper(requested_employee_id)) then
    raise exception 'This employee already has an HRIS account. Contact HR if you cannot sign in.';
  end if;

  if exists (select 1 from public.employee_account_requests
      where upper(btrim(employee_id)) = upper(requested_employee_id) and status = 'Pending') then
    raise exception 'An account request for this employee ID is already awaiting HR review.';
  end if;
  if exists (select 1 from public.user_accounts where lower(email) = normalized_email) then
    raise exception 'This email is already assigned to an HRIS account. Contact HR.';
  end if;
  if exists (select 1 from public.employee_account_requests
      where lower(email) = normalized_email and status = 'Pending') then
    raise exception 'A registration request using this email is already awaiting HR review.';
  end if;

  insert into public.employee_account_requests(
    auth_user_id, employee_id, email, full_name, submitted_full_name, requested_outlet
  ) values (
    new.id, requested_employee_id, normalized_email, employee_name, requested_full_name, requested_outlet
  );
  return new;
end;
$$;

create or replace function public.approve_employee_account_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row public.employee_account_requests;
  employee_row public.employees;
  auth_row auth.users;
  account_row public.user_accounts;
  generated_user_id text;
  name_parts text[];
  canonical_name text;
  created_new_employee boolean := false;
begin
  if not public.hris_has_role(array['hr_admin']) then
    raise exception 'Only HR/Admin can approve employee account requests.';
  end if;

  select * into request_row
  from public.employee_account_requests
  where id = p_request_id
  for update;
  if not found or request_row.status <> 'Pending' then
    raise exception 'This request is no longer pending.';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('employee-account-registration'),
    hashtext(upper(btrim(request_row.employee_id)))
  );

  select * into employee_row
  from public.employees
  where upper(btrim(employee_id)) = upper(btrim(request_row.employee_id))
  limit 1
  for update;

  if not found then
    -- HR-approved registrations become the official employee record, retaining the ID
    -- entered by the employee. Keep full name while populating the required name columns.
    name_parts := regexp_split_to_array(
      regexp_replace(btrim(coalesce(request_row.submitted_full_name, request_row.full_name)), '\s+', ' ', 'g'),
      '\s+'
    );
    if cardinality(name_parts) < 2 then
      raise exception 'The submitted full name must contain at least a first and last name.';
    end if;

    insert into public.employees(
      employee_id, first_name, middle_name, last_name, suffix, email, outlet, status
    ) values (
      btrim(request_row.employee_id), name_parts[1],
      case when cardinality(name_parts) > 2 then array_to_string(name_parts[2:cardinality(name_parts)-1], ' ') else null end,
      name_parts[cardinality(name_parts)], '', lower(request_row.email), request_row.requested_outlet, 'Active'
    ) returning * into employee_row;
    created_new_employee := true;
  end if;

  if exists (select 1 from public.user_accounts where employee_id = employee_row.employee_id) then
    raise exception 'This employee already has an HRIS account. No account was created.';
  end if;

  select * into auth_row from auth.users where id = request_row.auth_user_id;
  if not found then raise exception 'The registration login no longer exists.'; end if;
  if auth_row.email_confirmed_at is null then
    raise exception 'The employee must confirm the registration email before HR approval.';
  end if;
  if lower(coalesce(auth_row.email, '')) <> lower(request_row.email) then
    raise exception 'The registration email no longer matches the login.';
  end if;
  if exists (select 1 from public.user_accounts where lower(email) = lower(request_row.email)) then
    raise exception 'This email is already assigned to another HRIS account.';
  end if;

  canonical_name := concat_ws(' ', nullif(btrim(employee_row.first_name), ''),
    nullif(btrim(employee_row.middle_name), ''), nullif(btrim(employee_row.last_name), ''),
    nullif(btrim(employee_row.suffix), ''));
  generated_user_id := 'USR-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
  insert into public.user_accounts(
    user_id, auth_user_id, employee_id, full_name, first_name, middle_name, last_name, suffix,
    email, password, role, outlet, is_active
  ) values (
    generated_user_id, auth_row.id, employee_row.employee_id, canonical_name,
    employee_row.first_name, employee_row.middle_name, employee_row.last_name, employee_row.suffix,
    lower(request_row.email), null, 'employee', employee_row.outlet, true
  ) returning * into account_row;

  update public.employee_account_requests
  set status = 'Approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = request_row.id;

  return jsonb_build_object(
    'approved', true,
    'employee_created', created_new_employee,
    'employee_id', account_row.employee_id,
    'user_id', account_row.user_id
  );
end;
$$;

create or replace function public.get_my_performance_highlight()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  employee_row public.employees;
  latest_start date;
  latest_end date;
  latest_label text;
  own_score numeric(8,2);
  own_outlet text;
  best_score numeric(8,2);
  higher_count integer;
  employee_count integer;
begin
  select e.* into employee_row
  from public.user_accounts ua
  join public.employees e on e.employee_id = ua.employee_id
  where ua.auth_user_id = auth.uid()
    and ua.is_active = true
    and lower(ua.role) = 'employee'
  limit 1;

  if not found then
    raise exception 'An active employee account is required to view this highlight.';
  end if;

  select ev.evaluation_period_start, ev.evaluation_period_end, ev.evaluation_period_label
  into latest_start, latest_end, latest_label
  from public.employee_evaluations ev
  where ev.employee_id = employee_row.employee_id and ev.status = 'Approved'
  order by ev.evaluation_period_end desc, ev.approved_at desc nulls last, ev.updated_at desc
  limit 1;

  if latest_start is null or latest_end is null then
    return jsonb_build_object('evaluated', false, 'is_top_performer', false);
  end if;

  with latest_per_employee as (
    select distinct on (ev.employee_id)
      ev.employee_id,
      ev.final_weighted_score,
      coalesce(nullif(btrim(ev.outlet), ''), emp.outlet) as outlet
    from public.employee_evaluations ev
    left join public.employees emp on emp.employee_id = ev.employee_id
    where ev.status = 'Approved'
      and ev.evaluation_period_start = latest_start
      and ev.evaluation_period_end = latest_end
    order by ev.employee_id, ev.approved_at desc nulls last, ev.updated_at desc
  ), own as (
    select employee_id, final_weighted_score, outlet
    from latest_per_employee
    where employee_id = employee_row.employee_id
  ), outlet_scores as (
    select candidate.employee_id, candidate.final_weighted_score
    from latest_per_employee candidate
    join own on candidate.outlet is not distinct from own.outlet
  ), summary as (
    select max(scores.final_weighted_score) as best_score,
      count(*) filter (where scores.final_weighted_score > own.final_weighted_score)::integer as higher_count,
      count(*)::integer as employee_count
    from outlet_scores scores
    cross join own
  )
  select own.final_weighted_score, own.outlet, summary.best_score, summary.higher_count, summary.employee_count
  into own_score, own_outlet, best_score, higher_count, employee_count
  from own cross join summary;

  if own_score is null or own_outlet is null or btrim(own_outlet) = ''
     or employee_count is null or employee_count = 0 then
    return jsonb_build_object('evaluated', false, 'is_top_performer', false);
  end if;
  return jsonb_build_object(
    'evaluated', true,
    'is_top_performer', own_score = best_score,
    'score', own_score,
    'period_label', coalesce(nullif(latest_label, ''), to_char(latest_start, 'Mon DD, YYYY') || ' – ' || to_char(latest_end, 'Mon DD, YYYY')),
    'outlet', coalesce(own_outlet, ''),
    'rank', higher_count + 1,
    'outlet_employee_count', employee_count
  );
end;
$$;

revoke all on function public.get_my_performance_highlight() from public, anon;
grant execute on function public.get_my_performance_highlight() to authenticated;

notify pgrst, 'reload schema';
commit;
