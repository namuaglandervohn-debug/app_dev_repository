begin;

alter table public.schedule
  add column if not exists created_by uuid,
  add column if not exists validated_by uuid,
  add column if not exists validated_at timestamptz;

create or replace function hris_private.enforce_schedule_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Trusted server-side jobs may perform controlled schedule maintenance.
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
    end if;

    if TG_OP = 'UPDATE' then
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

    raise exception 'HR can only validate and publish draft schedules created by a Supervisor';
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

drop trigger if exists enforce_schedule_workflow on public.schedule;
create trigger enforce_schedule_workflow
  before insert or update or delete on public.schedule
  for each row execute function hris_private.enforce_schedule_workflow();

commit;
