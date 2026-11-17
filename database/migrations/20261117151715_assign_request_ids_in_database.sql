begin;

lock table public.employee_requests in share row exclusive mode;

create table hris_private.request_id_counters (
  request_year integer primary key,
  last_number bigint not null check (last_number > 0)
);
revoke all on hris_private.request_id_counters from public, anon, authenticated;

insert into hris_private.request_id_counters (request_year, last_number)
select parts[1]::integer, max(parts[2]::bigint)
from public.employee_requests
cross join lateral regexp_match(request_id, '^REQ-([0-9]{4})-([0-9]{4,15})$', 'i') as matched(parts)
where parts[2]::bigint > 0
group by parts[1];

create function hris_private.assign_employee_request_id()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  year_number integer := extract(year from statement_timestamp() at time zone 'Asia/Manila');
  next_number text;
begin
  insert into hris_private.request_id_counters as counter (request_year, last_number)
  values (year_number, 1)
  on conflict (request_year) do update set last_number = counter.last_number + 1
  returning last_number::text into next_number;

  new.request_id := 'REQ-' || year_number || '-' ||
    lpad(next_number, greatest(4, length(next_number)), '0');
  return new;
end;
$$;
revoke all on function hris_private.assign_employee_request_id() from public, anon, authenticated;

alter table public.employee_requests alter column request_id drop default;
create trigger assign_employee_request_id before insert on public.employee_requests
  for each row execute function hris_private.assign_employee_request_id();

commit;
