-- Enforce the same employee/date identity for manual and biometric attendance.
-- Keep legacy unlinked rows available for HR review without counting them twice.
create unique index if not exists attendance_logs_employee_date_key
  on public.attendance_logs (employee_id, attendance_date)
  where employee_id is not null and attendance_date is not null;
