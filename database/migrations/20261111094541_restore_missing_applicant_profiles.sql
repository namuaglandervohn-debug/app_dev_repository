insert into public.applicant_profiles (auth_user_id, profile)
select u.id, u.raw_user_meta_data->'applicant_profile'
from auth.users as u
where u.raw_user_meta_data->>'registration_kind' = 'applicant'
  and jsonb_typeof(u.raw_user_meta_data->'applicant_profile') = 'object'
  and nullif(trim(u.raw_user_meta_data->'applicant_profile'->>'firstName'), '') is not null
  and nullif(trim(u.raw_user_meta_data->'applicant_profile'->>'lastName'), '') is not null
  and (u.raw_user_meta_data->'applicant_profile'->>'birthdate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  and octet_length((u.raw_user_meta_data->'applicant_profile')::text) <= 100000
  and not exists (
    select 1 from public.user_accounts as a
    where a.auth_user_id = u.id or lower(a.email) = lower(u.email)
  )
on conflict (auth_user_id) do nothing;
