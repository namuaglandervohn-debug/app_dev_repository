begin;

-- Recruitment already sees these applications. Return only the avatar for each requested application.
create function hris_private.list_recruitment_profile_photos(p_application_ids text[])
returns table (applicant_id text, profile_photo text)
language sql stable security definer set search_path = ''
as $$
  select a.applicant_id, p.profile_photo
  from public.applicants a
  join public.applicant_profiles p on p.auth_user_id = a.auth_user_id
  where (select auth.uid()) is not null
    and (select public.hris_has_role(array['hr_admin', 'general_manager']))
    and cardinality(p_application_ids) <= 32
    and a.applicant_id = any(p_application_ids)
    and p.profile_photo is not null;
$$;

create function public.list_recruitment_profile_photos(p_application_ids text[])
returns table (applicant_id text, profile_photo text)
language sql stable security invoker set search_path = ''
as $$
  select * from hris_private.list_recruitment_profile_photos(p_application_ids);
$$;

revoke all on function hris_private.list_recruitment_profile_photos(text[]) from public, anon, authenticated;
revoke all on function public.list_recruitment_profile_photos(text[]) from public, anon, authenticated;
grant execute on function hris_private.list_recruitment_profile_photos(text[]) to authenticated;
grant execute on function public.list_recruitment_profile_photos(text[]) to authenticated;

commit;
