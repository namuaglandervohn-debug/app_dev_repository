begin;

create schema if not exists hris_private;

create function hris_private.next_staff_account_id(account_year text)
returns text language plpgsql security invoker set search_path = ''
as $$
declare
  next_number bigint;
begin
  -- Serialize allocation within each year, including simultaneous staff and recruitment inserts.
  perform pg_catalog.pg_advisory_xact_lock(19644591, account_year::integer);
  select coalesce(max(substring(a.user_id from '[0-9]{4,}$')::bigint), 0) + 1
    into next_number
    from public.user_accounts a
    where a.user_id ~ ('^USR-' || account_year || '-[0-9]{4,15}$');
  return 'USR-' || account_year || '-' ||
    pg_catalog.lpad(next_number::text, greatest(4, length(next_number::text)), '0');
end;
$$;
revoke all on function hris_private.next_staff_account_id(text) from public;

create function hris_private.assign_staff_account_id()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if nullif(btrim(new.user_id), '') is null or new.user_id ~ '^USR-[0-9]{4}-[A-F0-9]{16}$' then
    new.user_id := hris_private.next_staff_account_id(to_char(now() at time zone 'Asia/Manila', 'YYYY'));
  end if;
  return new;
end;
$$;
revoke all on function hris_private.assign_staff_account_id() from public;

create trigger assign_staff_account_id
  before insert on public.user_accounts
  for each row execute function hris_private.assign_staff_account_id();

-- Convert only unreferenced legacy IDs. Foreign keys also protect linked accounts.
do $$
declare
  account record;
begin
  for account in
    select a.id, a.user_id
    from public.user_accounts a
    where a.user_id ~ '^USR-[0-9]{4}-[A-F0-9]{16}$'
      and not exists (select 1 from public.employee_requests r where a.user_id in (r.hr_user_id, r.supervisor_user_id))
      and not exists (select 1 from public.employee_evaluations e where e.evaluator_user_id = a.user_id)
      and not exists (select 1 from public.evaluation_criteria c where a.user_id in (c.created_by_user_id, c.updated_by_user_id))
    order by a.created_at, a.id
  loop
    begin
      update public.user_accounts
        set user_id = hris_private.next_staff_account_id(split_part(account.user_id, '-', 2))
        where id = account.id and user_id = account.user_id;
    exception when foreign_key_violation then
      -- An account with dependent records retains its original ID.
      continue;
    end;
  end loop;
end;
$$;

commit;
