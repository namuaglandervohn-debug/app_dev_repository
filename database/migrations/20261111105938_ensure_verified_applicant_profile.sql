create or replace function public.ensure_my_applicant_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  signup_profile jsonb;
begin
  select u.raw_user_meta_data->'applicant_profile' into signup_profile
  from auth.users as u
  where u.id = caller_id
    and u.email_confirmed_at is not null
    and u.deleted_at is null
    and (u.banned_until is null or u.banned_until <= now())
    and lower(u.email) = lower(auth.jwt()->>'email')
    and u.raw_user_meta_data->>'registration_kind' = 'applicant'
    and not exists (
      select 1 from public.user_accounts as a
      where a.auth_user_id = u.id or lower(a.email) = lower(u.email)
    );

  if jsonb_typeof(signup_profile) is distinct from 'object'
    or nullif(btrim(signup_profile->>'firstName'), '') is null
    or nullif(btrim(signup_profile->>'lastName'), '') is null
    or not coalesce(signup_profile->>'birthdate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$', false)
    or octet_length(signup_profile::text) > 100000 then
    return null;
  end if;

  insert into public.applicant_profiles (auth_user_id, profile)
  values (caller_id, signup_profile)
  on conflict (auth_user_id) do nothing;

  return (select p.profile from public.applicant_profiles as p where p.auth_user_id = caller_id);
end;
$$;

revoke all on function public.ensure_my_applicant_profile() from public, anon, authenticated;
grant execute on function public.ensure_my_applicant_profile() to authenticated;
