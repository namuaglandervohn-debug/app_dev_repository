create policy "Signed-in users read active job postings"
on public.job_postings
for select
to authenticated
using (is_active is true);
