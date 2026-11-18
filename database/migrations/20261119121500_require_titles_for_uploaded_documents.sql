begin;

create or replace function hris_private.guard_employee_changes()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  document jsonb;
begin
  if not public.hris_has_role(array['employee']) then
    if TG_OP = 'DELETE' then return OLD; end if;
    return NEW;
  end if;
  if TG_OP <> 'UPDATE' then raise exception 'Employee accounts cannot perform this action'; end if;
  if not hris_private.is_own_employee(OLD.employee_id) then raise exception 'Employee record access denied'; end if;
  if TG_TABLE_NAME = 'employees' then
    if (to_jsonb(NEW) - array['phone_number','email','address','emergency_contact','documents','updated_at']) =
       (to_jsonb(OLD) - array['phone_number','email','address','emergency_contact','documents','updated_at']) then
      if NEW.documents is distinct from OLD.documents then
        if jsonb_typeof(coalesce(NEW.documents, '[]'::jsonb)) is distinct from 'array' then
          raise exception 'Employee documents must be a list of files.';
        end if;
        for document in select value from jsonb_array_elements(coalesce(NEW.documents, '[]'::jsonb)) loop
          if not (coalesce(OLD.documents, '[]'::jsonb) @> jsonb_build_array(document))
            and nullif(btrim(document->>'title'), '') is null then
            raise exception 'Add a descriptive title to every uploaded document.';
          end if;
        end loop;
      end if;
      return NEW;
    end if;
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

create or replace function hris_private.guard_applicant_document_titles()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  document jsonb;
begin
  if jsonb_typeof(coalesce(NEW.supporting_document_files, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Uploaded documents must be stored as a list of files.';
  end if;
  for document in select value from jsonb_array_elements(coalesce(NEW.supporting_document_files, '[]'::jsonb)) loop
    if TG_OP = 'INSERT' then
      if nullif(btrim(document->>'title'), '') is null then
        raise exception 'Add a descriptive title to every uploaded document.';
      end if;
    elsif not (coalesce(OLD.supporting_document_files, '[]'::jsonb) @> jsonb_build_array(document))
      and nullif(btrim(document->>'title'), '') is null then
      raise exception 'Add a descriptive title to every uploaded document.';
    end if;
  end loop;
  return NEW;
end;
$$;
revoke all on function hris_private.guard_applicant_document_titles() from public, anon, authenticated, service_role;

drop trigger if exists guard_applicant_document_titles on public.applicants;
create trigger guard_applicant_document_titles
  before insert or update of supporting_document_files on public.applicants
  for each row execute function hris_private.guard_applicant_document_titles();

commit;
