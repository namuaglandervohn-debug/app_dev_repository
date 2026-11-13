begin;

create schema if not exists hris_private;

-- Auth writes reauthentication_token along with encrypted_password when changing
-- a password. A sign-in that merely rehashes the same password writes only the hash.
-- Admin-issued replacements set their new app metadata after the password write.
create function hris_private.clear_temporary_password()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.raw_app_meta_data->'hris_temporary_password' = 'true'::jsonb
    and new.encrypted_password is distinct from old.encrypted_password
    and nullif(new.encrypted_password, '') is not null then
    new.raw_app_meta_data := new.raw_app_meta_data - 'hris_temporary_password';
  end if;
  return new;
end;
$$;
revoke all on function hris_private.clear_temporary_password() from public;
create trigger hris_clear_temporary_password
  before update of reauthentication_token on auth.users
  for each row execute function hris_private.clear_temporary_password();

commit;
