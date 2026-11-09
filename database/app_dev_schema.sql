-- Application schema copied from the existing project; no user records.
create extension if not exists pgcrypto with schema extensions;
create sequence public."schedule_schedule_id_seq" start 1 increment 1 minvalue 1 maxvalue 2147483647;
create table public."applicant_profiles" (
  "auth_user_id" uuid not null,
  "profile" jsonb default '{}'::jsonb not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."applicant_profiles" enable row level security;
revoke all on public."applicant_profiles" from anon,authenticated;
create table public."applicants" (
  "id" uuid default gen_random_uuid() not null,
  "applicant_id" text not null,
  "first_name" text not null,
  "middle_name" text,
  "last_name" text not null,
  "suffix" text not null,
  "email" text not null,
  "cover_letter" text not null,
  "phone_number" text,
  "address" text,
  "position_applied" text not null,
  "status" text default 'Submitted'::text not null,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "name" text,
  "gender" text,
  "civil_status" text,
  "birthdate" date,
  "birthplace" text,
  "height" text,
  "weight" text,
  "education" text,
  "experience" text,
  "tin" text,
  "sss" text,
  "philhealth" text,
  "pagibig" text,
  "emergency_contact" text,
  "resume_file_name" text,
  "resume_file_data" text,
  "supporting_documents" jsonb,
  "supporting_document_files" jsonb,
  "has_resume" boolean default false,
  "has_birth_cert" boolean default false,
  "has_tor" boolean default false,
  "has_med_cert" boolean default false,
  "requirements_note" text,
  "custom_requirements" jsonb default '[]'::jsonb,
  "interview_date" text,
  "interview_time" time without time zone,
  "interview_location" text,
  "interview_notes" text,
  "scheduled_by" text,
  "hiring_decision" text,
  "interview_feedback" text,
  "is_archived" boolean default false not null,
  "archived_at" timestamp with time zone,
  "archived_by" text,
  "archive_reason" text,
  "auth_user_id" uuid
);
alter table public."applicants" enable row level security;
revoke all on public."applicants" from anon,authenticated;
create table public."attendance_import_batches" (
  "id" uuid default gen_random_uuid() not null,
  "batch_id" text default ('BATCH-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "file_name" text,
  "file_type" text,
  "source" text default 'Biometric Import'::text not null,
  "imported_by_user_id" text,
  "total_rows" integer default 0,
  "successful_rows" integer default 0,
  "failed_rows" integer default 0,
  "status" text default 'Completed'::text not null,
  "remarks" text,
  "created_at" timestamp with time zone default now()
);
alter table public."attendance_import_batches" enable row level security;
revoke all on public."attendance_import_batches" from anon,authenticated;
create table public."attendance_logs" (
  "id" uuid default gen_random_uuid() not null,
  "log_id" text default ('ATT-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "batch_id" text,
  "employee_id" text,
  "biometric_user_id" text,
  "employee_name" text,
  "attendance_date" date not null,
  "time_in" time without time zone,
  "time_out" time without time zone,
  "raw_time_in" text,
  "raw_time_out" text,
  "raw_data" jsonb default '{}'::jsonb,
  "schedule_id" text,
  "is_matched_to_schedule" boolean default false,
  "total_hours" numeric(6,2) default 0,
  "late_minutes" integer default 0,
  "undertime_minutes" integer default 0,
  "overtime_minutes" integer default 0,
  "is_late" boolean default false,
  "is_undertime" boolean default false,
  "is_overtime" boolean default false,
  "is_absent" boolean default false,
  "is_incomplete" boolean default false,
  "source" text default 'Biometric Import'::text not null,
  "validation_status" text default 'Unprocessed'::text not null,
  "encoded_by_user_id" text,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."attendance_logs" enable row level security;
revoke all on public."attendance_logs" from anon,authenticated;
create table public."attendance_summaries" (
  "id" uuid default gen_random_uuid() not null,
  "summary_id" text default ('SUM-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "employee_id" text not null,
  "employee_name" text,
  "position" text,
  "outlet" text,
  "period_start" date not null,
  "period_end" date not null,
  "period_type" text default 'Custom'::text not null,
  "total_attendance_days" integer default 0,
  "total_present_days" integer default 0,
  "total_absent_days" integer default 0,
  "total_incomplete_days" integer default 0,
  "total_late_count" integer default 0,
  "total_undertime_count" integer default 0,
  "total_overtime_count" integer default 0,
  "total_late_minutes" integer default 0,
  "total_undertime_minutes" integer default 0,
  "total_overtime_minutes" integer default 0,
  "total_work_hours" numeric(8,2) default 0,
  "regular_hours" numeric(8,2) default 0,
  "overtime_hours" numeric(8,2) default 0,
  "source_log_ids" jsonb default '[]'::jsonb,
  "status" text default 'Draft'::text not null,
  "generated_by_user_id" text,
  "reviewed_by_user_id" text,
  "reviewed_at" timestamp with time zone,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."attendance_summaries" enable row level security;
revoke all on public."attendance_summaries" from anon,authenticated;
create table public."dss_result_items" (
  "id" uuid default gen_random_uuid() not null,
  "item_id" text default ('DSSITEM-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "result_id" text not null,
  "evaluation_id" text not null,
  "employee_id" text not null,
  "employee_name" text,
  "position" text,
  "outlet" text,
  "final_weighted_score" numeric(8,2) default 0 not null,
  "rating_label" text,
  "rank_no" integer not null,
  "recommendation" text,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."dss_result_items" enable row level security;
revoke all on public."dss_result_items" from anon,authenticated;
create table public."dss_results" (
  "id" uuid default gen_random_uuid() not null,
  "result_id" text default ('DSS-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "result_period_start" date not null,
  "result_period_end" date not null,
  "result_period_label" text,
  "total_employees" integer default 0,
  "highest_score" numeric(8,2) default 0,
  "average_score" numeric(8,2) default 0,
  "lowest_score" numeric(8,2) default 0,
  "top_employee_id" text,
  "top_employee_name" text,
  "status" text default 'Draft'::text not null,
  "generated_by_user_id" text,
  "generated_at" timestamp with time zone default now(),
  "approved_by_user_id" text,
  "approved_at" timestamp with time zone,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."dss_results" enable row level security;
revoke all on public."dss_results" from anon,authenticated;
create table public."employee_evaluation_scores" (
  "id" uuid default gen_random_uuid() not null,
  "score_id" text default ('SCORE-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "evaluation_id" text not null,
  "criteria_id" text not null,
  "criteria_name" text,
  "criteria_weight" numeric(5,2) default 0 not null,
  "max_score" numeric(6,2) default 100 not null,
  "raw_score" numeric(6,2) default 0 not null,
  "weighted_score" numeric(8,2) default 0 not null,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."employee_evaluation_scores" enable row level security;
revoke all on public."employee_evaluation_scores" from anon,authenticated;
create table public."employee_evaluations" (
  "id" uuid default gen_random_uuid() not null,
  "evaluation_id" text default ('EVAL-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "employee_id" text not null,
  "employee_name" text,
  "position" text,
  "outlet" text,
  "evaluation_period_start" date not null,
  "evaluation_period_end" date not null,
  "evaluation_period_label" text,
  "evaluator_user_id" text,
  "evaluator_name" text,
  "evaluator_role" text,
  "total_raw_score" numeric(8,2) default 0,
  "final_weighted_score" numeric(8,2) default 0,
  "rating_label" text,
  "status" text default 'Draft'::text not null,
  "remarks" text,
  "submitted_at" timestamp with time zone,
  "approved_by_user_id" text,
  "approved_at" timestamp with time zone,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."employee_evaluations" enable row level security;
revoke all on public."employee_evaluations" from anon,authenticated;
create table public."employee_leave_balances" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" text not null,
  "leave_type" text not null,
  "available" numeric(10,3) default 0 not null,
  "created_at" timestamp with time zone default now() not null,
  "updated_at" timestamp with time zone default now() not null
);
alter table public."employee_leave_balances" enable row level security;
revoke all on public."employee_leave_balances" from anon,authenticated;
create table public."employee_requests" (
  "id" uuid default gen_random_uuid() not null,
  "request_id" text default ('REQ-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "employee_id" text not null,
  "request_type" text not null,
  "leave_type" text,
  "start_date" date not null,
  "end_date" date not null,
  "start_time" time without time zone,
  "end_time" time without time zone,
  "total_days" numeric(6,2) default 0,
  "total_hours" numeric(6,2) default 0,
  "reason" text not null,
  "attachment_files" jsonb default '[]'::jsonb,
  "status" text default 'Pending'::text not null,
  "reviewed_by_user_id" text,
  "reviewed_at" timestamp with time zone,
  "reviewer_remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "supervisor_status" text default 'Pending'::text,
  "supervisor_note" text,
  "supervisor_user_id" text,
  "supervisor_name" text,
  "supervisor_reviewed_at" timestamp with time zone,
  "hr_status" text default 'Pending'::text,
  "hr_note" text,
  "hr_user_id" text,
  "hr_name" text,
  "hr_reviewed_at" timestamp with time zone
);
alter table public."employee_requests" enable row level security;
revoke all on public."employee_requests" from anon,authenticated;
create table public."employees" (
  "id" uuid default gen_random_uuid() not null,
  "employee_id" text not null,
  "first_name" text not null,
  "middle_name" text,
  "last_name" text not null,
  "suffix" text default ''::text,
  "email" text,
  "phone_number" text,
  "address" text,
  "gender" text,
  "civil_status" text,
  "birthdate" date,
  "birthplace" text,
  "department" text,
  "outlet" text,
  "position" text,
  "employment_type" text,
  "status" text default 'Active'::text,
  "hire_date" date,
  "salary" numeric,
  "education" text,
  "experience" text,
  "tin" text,
  "sss" text,
  "philhealth" text,
  "pagibig" text,
  "emergency_contact" text,
  "created_at" timestamp with time zone default now(),
  "documents" jsonb,
  "applicant_id" text,
  "biometric_user_id" text
);
alter table public."employees" enable row level security;
revoke all on public."employees" from anon,authenticated;
create table public."evaluation_criteria" (
  "criteria_name" character varying(255),
  "weight" numeric(5,2),
  "criteria_id" text default ('CRIT-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "description" text,
  "category" text,
  "max_score" numeric(6,2) default 100,
  "is_active" boolean default true not null,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."evaluation_criteria" enable row level security;
revoke all on public."evaluation_criteria" from anon,authenticated;
create table public."job_postings" (
  "id" uuid default gen_random_uuid() not null,
  "title" text not null,
  "department" text,
  "location" text,
  "employment_type" text default 'Full-Time'::text,
  "salary_range" text,
  "description" text,
  "qualifications" text,
  "responsibilities" text,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."job_postings" enable row level security;
revoke all on public."job_postings" from anon,authenticated;
create table public."leave_types" (
  "id" uuid default gen_random_uuid() not null,
  "name" text not null,
  "description" text default ''::text not null,
  "is_active" boolean default true not null,
  "created_at" timestamp with time zone default now() not null
);
alter table public."leave_types" enable row level security;
revoke all on public."leave_types" from anon,authenticated;
create table public."notifications" (
  "id" uuid default gen_random_uuid() not null,
  "recipient_role" text,
  "recipient_employee_id" text,
  "title" text not null,
  "message" text not null,
  "type" text,
  "is_read" boolean default false,
  "created_at" timestamp with time zone default now()
);
alter table public."notifications" enable row level security;
revoke all on public."notifications" from anon,authenticated;
create table public."payroll_items" (
  "id" uuid default gen_random_uuid() not null,
  "payroll_item_id" text default ('PAYITEM-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "payroll_id" text not null,
  "attendance_summary_id" text,
  "employee_id" text not null,
  "employee_name" text,
  "position" text,
  "outlet" text,
  "salary_rate" numeric(12,2) default 0,
  "rate_type" text default 'Monthly'::text not null,
  "total_work_hours" numeric(10,2) default 0,
  "regular_hours" numeric(10,2) default 0,
  "overtime_hours" numeric(10,2) default 0,
  "total_late_minutes" integer default 0,
  "total_undertime_minutes" integer default 0,
  "total_absent_days" integer default 0,
  "total_incomplete_days" integer default 0,
  "basic_pay" numeric(12,2) default 0,
  "overtime_pay" numeric(12,2) default 0,
  "late_deduction" numeric(12,2) default 0,
  "undertime_deduction" numeric(12,2) default 0,
  "absence_deduction" numeric(12,2) default 0,
  "other_deductions" numeric(12,2) default 0,
  "gross_pay" numeric(12,2) default 0,
  "total_deductions" numeric(12,2) default 0,
  "net_pay" numeric(12,2) default 0,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now(),
  "payslip_details" jsonb default '{}'::jsonb not null
);
alter table public."payroll_items" enable row level security;
revoke all on public."payroll_items" from anon,authenticated;
create table public."payroll_summaries" (
  "id" uuid default gen_random_uuid() not null,
  "payroll_id" text default ('PAY-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "period_start" date not null,
  "period_end" date not null,
  "cutoff_label" text,
  "total_employees" integer default 0,
  "total_regular_hours" numeric(10,2) default 0,
  "total_overtime_hours" numeric(10,2) default 0,
  "total_late_minutes" integer default 0,
  "total_undertime_minutes" integer default 0,
  "total_gross_pay" numeric(12,2) default 0,
  "total_deductions" numeric(12,2) default 0,
  "total_overtime_pay" numeric(12,2) default 0,
  "total_net_pay" numeric(12,2) default 0,
  "status" text default 'Draft'::text not null,
  "prepared_by_user_id" text,
  "reviewed_by_user_id" text,
  "reviewed_at" timestamp with time zone,
  "endorsed_to" text default 'Accounting and Finance Personnel'::text,
  "endorsed_at" timestamp with time zone,
  "remarks" text,
  "created_at" timestamp with time zone default now(),
  "updated_at" timestamp with time zone default now()
);
alter table public."payroll_summaries" enable row level security;
revoke all on public."payroll_summaries" from anon,authenticated;
create table public."schedule" (
  "schedule_id" text default nextval('schedule_schedule_id_seq'::regclass) not null,
  "employee_id" text,
  "week" text,
  "outlet" character varying(255),
  "position" character varying(255),
  "time_in" time without time zone,
  "time_out" time without time zone,
  "is_finalized" boolean default false,
  "break_time" text,
  "monday" text,
  "tuesday" text,
  "wednesday" text,
  "thursday" text,
  "friday" text,
  "saturday" text,
  "sunday" text,
  "status" text,
  "confirmed_by" text,
  "confirmed_at" timestamp with time zone,
  "declined_by" text,
  "declined_at" timestamp with time zone
);
alter table public."schedule" enable row level security;
revoke all on public."schedule" from anon,authenticated;
create table public."system_logs" (
  "id" uuid default gen_random_uuid() not null,
  "log_id" text default ('LOG-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10))) not null,
  "user_id" text,
  "user_name" text,
  "user_role" text,
  "action" text not null,
  "module" text not null,
  "record_id" text,
  "record_table" text,
  "description" text,
  "old_data" jsonb,
  "new_data" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp with time zone default now()
);
alter table public."system_logs" enable row level security;
revoke all on public."system_logs" from anon,authenticated;
create table public."user_accounts" (
  "id" uuid default gen_random_uuid() not null,
  "applicant_id" text,
  "first_name" text,
  "middle_name" text,
  "last_name" text,
  "full_name" text,
  "email" text,
  "password" text,
  "role" text default 'employee'::text,
  "outlet" text,
  "is_active" boolean default true,
  "created_at" timestamp with time zone default now(),
  "user_id" text,
  "employee_id" text,
  "suffix" text,
  "auth_user_id" uuid
);
alter table public."user_accounts" enable row level security;
revoke all on public."user_accounts" from anon,authenticated;
alter sequence public.schedule_schedule_id_seq owned by public.schedule.schedule_id;
