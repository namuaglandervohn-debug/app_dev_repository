# Applicant accounts, employee filters and leave types

Apply `database/migrations/2026_11_01_000001_applicant_profiles_and_leave_types.sql` in Supabase before using this release. It is transactional and can be rerun safely. Back up the database using the normal project process before a release.

Production authentication also needs the live site URL, exact `/applicant` redirect URLs for the canonical and apex production domains, and a working custom SMTP sender. The project uses Resend: `smtp.resend.com`, port `465`, username `resend`, with the server's Resend API key as the SMTP password. Enter that secret through the provider's secure settings; never commit it. See [Resend SMTP settings](https://resend.com/docs/send-with-smtp).

- `/applicant` provides registration, sign-in, a reusable profile and a list of the signed-in applicant's applications. Registration uses Supabase email confirmation when enabled in the project.
- `/apply` requires an applicant login, loads saved personal details and saves reviewed details for future applications. Position, source, signed declarations and uploaded application documents remain specific to each application. Past application snapshots are not overwritten.
- `submit_profile_application` allocates sequential IDs on the server without granting applicants access to other applicants' IDs. HR can continue entering legacy applications from Recruitment.
- HR/GM hiring calls `convert_applicant_account` for registered applicants. It links the same Auth identity to the employee record without replacing the email or password. Legacy applicants retain the existing employee-account creation flow. The legacy Vercel account endpoint refuses to create a second login for a registered applicant.
- Applicant logins cannot access internal tables. An active `user_accounts` record is required for internal-module access. Existing HR/Admin (`hr_admin`) is the Super Admin; no additional administrator account is introduced.
- Request Management's **Manage leave types** utility lets HR/Admin add, rename, describe, activate or deactivate leave types. Historical request labels remain unchanged. A database trigger prevents new requests using inactive types, including stale browser submissions. Leave type configuration does not change the existing company-paid leave allowance calculation.
- Employee Records separates search text, search-field selection and independent filters for every data column. Filters combine with AND. **Clear all** resets both search and filters.

Verification: `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run build`, `npm run build:laravel`.

Database integration checks are in `tests/profileAndLeaveDatabase.sql`. To run without retaining fixtures, start with the migration SQL, replace its final `commit;` with the test SQL, then append `rollback;`. The tests use synthetic accounts and verify privacy, snapshots, sequential numbering, conversion without password replacement, leave-type permissions and deactivation. Do not run the test file alone in production.
