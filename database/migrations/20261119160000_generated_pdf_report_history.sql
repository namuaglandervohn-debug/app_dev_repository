begin;

create table if not exists public.generated_report_history (
  id uuid primary key default gen_random_uuid(),
  report_title text not null check (length(btrim(report_title)) between 1 and 120),
  report_type text not null check (length(btrim(report_type)) between 1 and 60),
  period_start date,
  period_end date,
  file_name text not null check (file_name ~ '\.pdf$'),
  storage_path text not null unique,
  record_count integer not null default 0 check (record_count >= 0),
  prepared_by text not null check (length(btrim(prepared_by)) between 1 and 180),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint generated_report_period_check check (period_start is null or period_end is null or period_end >= period_start)
);

create index if not exists generated_report_history_created_at_idx
  on public.generated_report_history(created_at desc);

alter table public.generated_report_history enable row level security;
revoke all on public.generated_report_history from public, anon, authenticated;
drop policy if exists "Report staff read generated PDF history" on public.generated_report_history;
create policy "Report staff read generated PDF history" on public.generated_report_history
  for select to authenticated
  using (public.hris_has_role(array['hr_admin','general_manager','accounting_finance']));
drop policy if exists "Report staff save generated PDF history" on public.generated_report_history;
create policy "Report staff save generated PDF history" on public.generated_report_history
  for insert to authenticated
  with check (
    public.hris_has_role(array['hr_admin','general_manager','accounting_finance'])
    and created_by = auth.uid()
    and storage_path like auth.uid()::text || '/%'
  );
grant select, insert on public.generated_report_history to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('hr-report-pdfs', 'hr-report-pdfs', false, 26214400, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Report staff download generated PDF files" on storage.objects;
create policy "Report staff download generated PDF files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hr-report-pdfs'
    and public.hris_has_role(array['hr_admin','general_manager','accounting_finance'])
  );
drop policy if exists "Report staff upload own generated PDF files" on storage.objects;
create policy "Report staff upload own generated PDF files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hr-report-pdfs'
    and public.hris_has_role(array['hr_admin','general_manager','accounting_finance'])
    and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "Report staff remove own generated PDF files" on storage.objects;
create policy "Report staff remove own generated PDF files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'hr-report-pdfs'
    and public.hris_has_role(array['hr_admin','general_manager','accounting_finance'])
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
