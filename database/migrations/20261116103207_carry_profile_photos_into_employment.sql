begin;

alter table public.applicant_profiles add column profile_photo text,
  add constraint applicant_profile_photo_format check (
    profile_photo is null or (length(profile_photo) <= 196608 and profile_photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  );

alter table public.employees add column profile_photo text,
  add constraint employee_profile_photo_format check (
    profile_photo is null or (length(profile_photo) <= 196608 and profile_photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  );

create or replace function hris_private.guard_employee_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.hris_has_role(array['employee']) then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;
  if TG_OP <> 'UPDATE' then raise exception 'Employee accounts cannot perform this action'; end if;
  if not hris_private.is_own_employee(OLD.employee_id) then raise exception 'Employee record access denied'; end if;
  if TG_TABLE_NAME = 'employees' then
    if (to_jsonb(NEW) - array['phone_number','email','address','emergency_contact','updated_at','profile_photo']) =
       (to_jsonb(OLD) - array['phone_number','email','address','emergency_contact','updated_at','profile_photo']) then return NEW; end if;
  elsif TG_TABLE_NAME = 'schedule' then
    if OLD.status = 'Published' and NEW.status in ('Confirmed','Declined')
      and (to_jsonb(NEW) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at']) =
          (to_jsonb(OLD) - array['status','confirmed_by','confirmed_at','declined_by','declined_at','updated_at']) then return NEW; end if;
  elsif TG_TABLE_NAME = 'employee_requests' then
    if OLD.status = 'Pending' and NEW.status = 'Cancelled'
      and (to_jsonb(NEW) - array['status','updated_at']) = (to_jsonb(OLD) - array['status','updated_at']) then return NEW; end if;
  end if;
  raise exception 'Employee account cannot change these fields';
end;
$$;

create function hris_private.inherit_applicant_profile_photo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.profile_photo is null and new.applicant_id is not null then
    select p.profile_photo into new.profile_photo
    from public.applicants a
    join public.applicant_profiles p on p.auth_user_id = a.auth_user_id
    where a.applicant_id = new.applicant_id;
  end if;
  return new;
end;
$$;
revoke all on function hris_private.inherit_applicant_profile_photo() from public, anon, authenticated, service_role;

create trigger inherit_applicant_profile_photo
  before insert or update of applicant_id on public.employees
  for each row execute function hris_private.inherit_applicant_profile_photo();

commit;
