-- Constraints, functions and access rules for APP_DEV_DATABASE.
set search_path=public,extensions;
alter table applicant_profiles add constraint applicant_profile_birthdate CHECK ((COALESCE((profile ->> 'birthdate'::text), ''::text) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'::text));
alter table applicant_profiles add constraint applicant_profile_names CHECK (((length(TRIM(BOTH FROM COALESCE((profile ->> 'firstName'::text), ''::text))) > 0) AND (length(TRIM(BOTH FROM COALESCE((profile ->> 'lastName'::text), ''::text))) > 0)));
alter table applicant_profiles add constraint applicant_profile_size CHECK ((octet_length((profile)::text) <= 100000));
alter table applicant_profiles add constraint applicant_profiles_pkey PRIMARY KEY (auth_user_id);
alter table applicants add constraint applicants_applicant_id_key UNIQUE (applicant_id);
alter table applicants add constraint applicants_pkey PRIMARY KEY (id);
alter table attendance_import_batches add constraint attendance_import_batches_batch_id_key UNIQUE (batch_id);
alter table attendance_import_batches add constraint attendance_import_batches_pkey PRIMARY KEY (id);
alter table attendance_import_batches add constraint attendance_import_batches_source_check CHECK ((source = ANY (ARRAY['Biometric Import'::text, 'Manual Encoding'::text, 'Logbook Encoding'::text])));
alter table attendance_import_batches add constraint attendance_import_batches_status_check CHECK ((status = ANY (ARRAY['Processing'::text, 'Completed'::text, 'Failed'::text, 'Partially Completed'::text])));
alter table attendance_logs add constraint attendance_logs_log_id_key UNIQUE (log_id);
alter table attendance_logs add constraint attendance_logs_pkey PRIMARY KEY (id);
alter table attendance_logs add constraint attendance_logs_source_check CHECK ((source = ANY (ARRAY['Biometric Import'::text, 'Manual Encoding'::text, 'Logbook Encoding'::text])));
alter table attendance_logs add constraint attendance_logs_validation_status_check CHECK ((validation_status = ANY (ARRAY['Unprocessed'::text, 'Validated'::text, 'Needs Review'::text, 'Invalid'::text, 'Corrected'::text])));
alter table attendance_summaries add constraint attendance_summaries_period_check CHECK ((period_end >= period_start));
alter table attendance_summaries add constraint attendance_summaries_period_type_check CHECK ((period_type = ANY (ARRAY['Daily'::text, 'Weekly'::text, 'Cutoff'::text, 'Monthly'::text, 'Custom'::text])));
alter table attendance_summaries add constraint attendance_summaries_pkey PRIMARY KEY (id);
alter table attendance_summaries add constraint attendance_summaries_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Reviewed'::text, 'Approved'::text, 'Exported'::text])));
alter table attendance_summaries add constraint attendance_summaries_summary_id_key UNIQUE (summary_id);
alter table attendance_summaries add constraint attendance_summaries_unique_period UNIQUE (employee_id, period_start, period_end);
alter table dss_result_items add constraint dss_result_items_item_id_key UNIQUE (item_id);
alter table dss_result_items add constraint dss_result_items_pkey PRIMARY KEY (id);
alter table dss_result_items add constraint dss_result_items_unique_evaluation UNIQUE (result_id, evaluation_id);
alter table dss_result_items add constraint dss_result_items_unique_rank UNIQUE (result_id, rank_no);
alter table dss_results add constraint dss_results_period_check CHECK ((result_period_end >= result_period_start));
alter table dss_results add constraint dss_results_pkey PRIMARY KEY (id);
alter table dss_results add constraint dss_results_result_id_key UNIQUE (result_id);
alter table dss_results add constraint dss_results_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Reviewed'::text, 'Approved'::text, 'Exported'::text])));
alter table dss_results add constraint dss_results_unique_period UNIQUE (result_period_start, result_period_end);
alter table employee_evaluation_scores add constraint employee_evaluation_scores_pkey PRIMARY KEY (id);
alter table employee_evaluation_scores add constraint employee_evaluation_scores_raw_score_check CHECK ((raw_score >= (0)::numeric));
alter table employee_evaluation_scores add constraint employee_evaluation_scores_score_id_key UNIQUE (score_id);
alter table employee_evaluation_scores add constraint employee_evaluation_scores_unique_criteria UNIQUE (evaluation_id, criteria_id);
alter table employee_evaluation_scores add constraint employee_evaluation_scores_weight_check CHECK (((criteria_weight >= (0)::numeric) AND (criteria_weight <= (100)::numeric)));
alter table employee_evaluations add constraint employee_evaluations_evaluation_id_key UNIQUE (evaluation_id);
alter table employee_evaluations add constraint employee_evaluations_period_check CHECK ((evaluation_period_end >= evaluation_period_start));
alter table employee_evaluations add constraint employee_evaluations_pkey PRIMARY KEY (id);
alter table employee_evaluations add constraint employee_evaluations_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Submitted'::text, 'Reviewed'::text, 'Approved'::text, 'Returned'::text, 'Cancelled'::text])));
alter table employee_evaluations add constraint employee_evaluations_unique_period UNIQUE (employee_id, evaluation_period_start, evaluation_period_end);
alter table employee_leave_balances add constraint employee_leave_balances_available_check CHECK ((available >= (0)::numeric));
alter table employee_leave_balances add constraint employee_leave_balances_employee_id_leave_type_key UNIQUE (employee_id, leave_type);
alter table employee_leave_balances add constraint employee_leave_balances_pkey PRIMARY KEY (id);
alter table employee_requests add constraint employee_requests_date_check CHECK ((end_date >= start_date));
alter table employee_requests add constraint employee_requests_hr_status_check CHECK (((hr_status IS NULL) OR (hr_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Disapproved'::text]))));
alter table employee_requests add constraint employee_requests_leave_type_check CHECK (((request_type <> 'Leave'::text) OR (leave_type IS NOT NULL)));
alter table employee_requests add constraint employee_requests_pkey PRIMARY KEY (id);
alter table employee_requests add constraint employee_requests_request_id_key UNIQUE (request_id);
alter table employee_requests add constraint employee_requests_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Supervisor Approved'::text, 'Approved'::text, 'Disapproved'::text, 'Rejected'::text, 'Cancelled'::text])));
alter table employee_requests add constraint employee_requests_supervisor_status_check CHECK (((supervisor_status IS NULL) OR (supervisor_status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Disapproved'::text]))));
alter table employee_requests add constraint employee_requests_type_check CHECK ((request_type = ANY (ARRAY['Leave'::text, 'Overtime'::text, 'Undertime'::text])));
alter table employees add constraint employees_applicant_id_key UNIQUE (applicant_id);
alter table employees add constraint employees_email_key UNIQUE (email);
alter table employees add constraint employees_employee_id_key UNIQUE (employee_id);
alter table employees add constraint employees_employee_id_unique UNIQUE (employee_id);
alter table employees add constraint employees_pkey PRIMARY KEY (id);
alter table evaluation_criteria add constraint evaluation_criteria_pkey PRIMARY KEY (criteria_id);
alter table job_postings add constraint job_postings_pkey PRIMARY KEY (id);
alter table leave_types add constraint leave_types_description_check CHECK ((length(description) <= 1000));
alter table leave_types add constraint leave_types_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 100)));
alter table leave_types add constraint leave_types_pkey PRIMARY KEY (id);
alter table notifications add constraint notifications_pkey PRIMARY KEY (id);
alter table payroll_items add constraint payroll_items_payroll_item_id_key UNIQUE (payroll_item_id);
alter table payroll_items add constraint payroll_items_pkey PRIMARY KEY (id);
alter table payroll_items add constraint payroll_items_rate_type_check CHECK ((rate_type = ANY (ARRAY['Monthly'::text, 'Daily'::text, 'Hourly'::text])));
alter table payroll_summaries add constraint payroll_summaries_payroll_id_key UNIQUE (payroll_id);
alter table payroll_summaries add constraint payroll_summaries_period_check CHECK ((period_end >= period_start));
alter table payroll_summaries add constraint payroll_summaries_pkey PRIMARY KEY (id);
alter table payroll_summaries add constraint payroll_summaries_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Reviewed'::text, 'Approved'::text, 'Endorsed'::text, 'Exported'::text])));
alter table payroll_summaries add constraint payroll_summaries_unique_period UNIQUE (period_start, period_end);
alter table schedule add constraint schedule_pkey PRIMARY KEY (schedule_id);
alter table schedule add constraint schedule_schedule_id_unique UNIQUE (schedule_id);
alter table system_logs add constraint system_logs_log_id_key UNIQUE (log_id);
alter table system_logs add constraint system_logs_pkey PRIMARY KEY (id);
alter table user_accounts add constraint user_accounts_applicant_id_unique UNIQUE (applicant_id);
alter table user_accounts add constraint user_accounts_email_key UNIQUE (email);
alter table user_accounts add constraint user_accounts_pkey PRIMARY KEY (id);
alter table user_accounts add constraint user_accounts_role_check CHECK ((role = ANY (ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])));
alter table user_accounts add constraint user_accounts_user_id_key UNIQUE (user_id);
alter table user_accounts add constraint user_accounts_user_id_unique UNIQUE (user_id);
alter table applicant_profiles add constraint applicant_profiles_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table applicants add constraint applicants_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
alter table attendance_import_batches add constraint attendance_import_batches_imported_by_fkey FOREIGN KEY (imported_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table attendance_logs add constraint attendance_logs_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES attendance_import_batches(batch_id) ON DELETE SET NULL;
alter table attendance_logs add constraint attendance_logs_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL;
alter table attendance_logs add constraint attendance_logs_encoded_by_fkey FOREIGN KEY (encoded_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table attendance_logs add constraint attendance_logs_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedule(schedule_id) ON DELETE SET NULL;
alter table attendance_summaries add constraint attendance_summaries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table attendance_summaries add constraint attendance_summaries_generated_by_fkey FOREIGN KEY (generated_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table attendance_summaries add constraint attendance_summaries_reviewed_by_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table dss_result_items add constraint dss_result_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table dss_result_items add constraint dss_result_items_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES employee_evaluations(evaluation_id) ON DELETE CASCADE;
alter table dss_result_items add constraint dss_result_items_result_id_fkey FOREIGN KEY (result_id) REFERENCES dss_results(result_id) ON DELETE CASCADE;
alter table dss_results add constraint dss_results_approved_by_fkey FOREIGN KEY (approved_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table dss_results add constraint dss_results_generated_by_fkey FOREIGN KEY (generated_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table employee_evaluation_scores add constraint employee_evaluation_scores_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES evaluation_criteria(criteria_id) ON DELETE RESTRICT;
alter table employee_evaluation_scores add constraint employee_evaluation_scores_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES employee_evaluations(evaluation_id) ON DELETE CASCADE;
alter table employee_evaluations add constraint employee_evaluations_approved_by_user_id_fkey FOREIGN KEY (approved_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table employee_evaluations add constraint employee_evaluations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table employee_leave_balances add constraint employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table employee_requests add constraint employee_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table employee_requests add constraint employee_requests_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table payroll_items add constraint payroll_items_attendance_summary_id_fkey FOREIGN KEY (attendance_summary_id) REFERENCES attendance_summaries(summary_id) ON DELETE SET NULL;
alter table payroll_items add constraint payroll_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE;
alter table payroll_items add constraint payroll_items_payroll_id_fkey FOREIGN KEY (payroll_id) REFERENCES payroll_summaries(payroll_id) ON DELETE CASCADE;
alter table payroll_summaries add constraint payroll_summaries_prepared_by_fkey FOREIGN KEY (prepared_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table payroll_summaries add constraint payroll_summaries_reviewed_by_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table schedule add constraint schedule_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE SET NULL;
alter table system_logs add constraint system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL;
alter table user_accounts add constraint user_accounts_applicant_id_fkey FOREIGN KEY (applicant_id) REFERENCES applicants(applicant_id) ON UPDATE CASCADE ON DELETE SET NULL;
alter table user_accounts add constraint user_accounts_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table user_accounts add constraint user_accounts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.bind_applicant_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.role() = 'service_role' or public.hris_has_role(array['hr_admin','general_manager']) then return new; end if;
  if auth.uid() is null then raise exception 'Please create an applicant account and sign in before applying.'; end if;
  if not exists(select 1 from public.applicant_profiles where auth_user_id = auth.uid()) then raise exception 'Complete your applicant registration before applying.'; end if;
  if exists(select 1 from public.user_accounts where auth_user_id = auth.uid()) then raise exception 'This account has already been converted into an employee account.'; end if;
  new.auth_user_id := auth.uid();
  new.email := auth.jwt()->>'email';
  new.status := 'Submitted';
  return new;
end; $function$
;
revoke all on function public.bind_applicant_identity() from public,anon,authenticated;
grant execute on function public.bind_applicant_identity() to service_role;
grant execute on function public.bind_applicant_identity() to authenticated;
CREATE OR REPLACE FUNCTION public.check_active_evaluation_criteria_weights()
 RETURNS TABLE(total_weight numeric, is_ready boolean, message text)
 LANGUAGE plpgsql
AS $function$
declare
  v_total numeric;
begin
  select coalesce(sum(weight), 0)
  into v_total
  from public.evaluation_criteria
  where is_active = true;

  return query
  select
    v_total as total_weight,
    (v_total = 100) as is_ready,
    case
      when v_total = 100 then 'Ready for DSS computation. Active criteria weights total 100%.'
      when v_total < 100 then 'Not ready. Active criteria weights are below 100%.'
      else 'Not ready. Active criteria weights exceed 100%.'
    end as message;
end;
$function$
;
revoke all on function public.check_active_evaluation_criteria_weights() from public,anon,authenticated;
grant execute on function public.check_active_evaluation_criteria_weights() to service_role;
grant execute on function public.check_active_evaluation_criteria_weights() to authenticated;
CREATE OR REPLACE FUNCTION public.convert_applicant_account(p_applicant_id text, p_employee_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare app public.applicants; emp public.employees; existing public.user_accounts; identity auth.users; saved public.user_accounts;
begin
  if not public.hris_has_role(array['hr_admin','general_manager']) then raise exception 'Only HR/Admin or General Manager can convert applicant accounts.'; end if;
  select * into app from public.applicants where applicant_id=p_applicant_id for update;
  if not found or app.status <> 'Hired' or app.auth_user_id is null then raise exception 'A hired application with an applicant account is required.'; end if;
  select * into emp from public.employees where employee_id=p_employee_id and applicant_id=p_applicant_id;
  if not found then raise exception 'Save the matching employee record first.'; end if;
  select * into identity from auth.users where id=app.auth_user_id;
  if not found then raise exception 'The applicant login no longer exists.'; end if;
  select * into existing from public.user_accounts where auth_user_id=identity.id or employee_id=p_employee_id limit 1;
  if found then
    if existing.auth_user_id is distinct from identity.id or existing.employee_id is distinct from p_employee_id or existing.role <> 'employee' then
      raise exception 'This applicant or employee is already linked to a different account. No account was changed.';
    end if;
    saved := existing;
  else
    insert into public.user_accounts(user_id,auth_user_id,employee_id,full_name,first_name,middle_name,last_name,suffix,email,password,role,outlet,is_active)
    values('USR-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),identity.id,p_employee_id,app.name,app.first_name,app.middle_name,app.last_name,app.suffix,identity.email,null,'employee',emp.outlet,true)
    returning * into saved;
  end if;
  return jsonb_build_object('auth_user_id',identity.id,'email',saved.email,'employee_id',saved.employee_id,'converted',true);
end; $function$
;
revoke all on function public.convert_applicant_account(text,text) from public,anon,authenticated;
grant execute on function public.convert_applicant_account(text,text) to service_role;
grant execute on function public.convert_applicant_account(text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.create_employee_evaluation_template(p_employee_id text, p_period_start date, p_period_end date, p_period_label text DEFAULT NULL::text, p_evaluator_user_id text DEFAULT NULL::text, p_evaluator_name text DEFAULT NULL::text, p_evaluator_role text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_evaluation_id text;
  v_total_weight numeric;
begin
  -- Make sure active criteria weights total 100%
  select coalesce(sum(weight), 0)
  into v_total_weight
  from public.evaluation_criteria
  where is_active = true;

  if v_total_weight <> 100 then
    raise exception 'Cannot create evaluation. Active criteria weights total %, not 100.', v_total_weight;
  end if;

  -- Create or update evaluation record
  insert into public.employee_evaluations (
    employee_id,
    employee_name,
    position,
    outlet,
    evaluation_period_start,
    evaluation_period_end,
    evaluation_period_label,
    evaluator_user_id,
    evaluator_name,
    evaluator_role,
    status
  )
  select
    e.employee_id,
    concat_ws(' ', e.first_name, e.middle_name, e.last_name, e.suffix),
    e.position,
    e.outlet,
    p_period_start,
    p_period_end,
    p_period_label,
    p_evaluator_user_id,
    p_evaluator_name,
    p_evaluator_role,
    'Draft'
  from public.employees e
  where e.employee_id = p_employee_id

  on conflict (employee_id, evaluation_period_start, evaluation_period_end)
  do update set
    employee_name = excluded.employee_name,
    position = excluded.position,
    outlet = excluded.outlet,
    evaluation_period_label = excluded.evaluation_period_label,
    evaluator_user_id = excluded.evaluator_user_id,
    evaluator_name = excluded.evaluator_name,
    evaluator_role = excluded.evaluator_role,
    updated_at = now()

  returning evaluation_id into v_evaluation_id;

  -- Add active criteria as score rows
  insert into public.employee_evaluation_scores (
    evaluation_id,
    criteria_id,
    criteria_name,
    criteria_weight,
    max_score,
    raw_score,
    weighted_score
  )
  select
    v_evaluation_id,
    ec.criteria_id,
    ec.criteria_name,
    ec.weight,
    ec.max_score,
    0,
    0
  from public.evaluation_criteria ec
  where ec.is_active = true

  on conflict (evaluation_id, criteria_id)
  do update set
    criteria_name = excluded.criteria_name,
    criteria_weight = excluded.criteria_weight,
    max_score = excluded.max_score,
    updated_at = now();

  return v_evaluation_id;
end;
$function$
;
revoke all on function public.create_employee_evaluation_template(text,date,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_employee_evaluation_template(text,date,date,text,text,text,text) to service_role;
grant execute on function public.create_employee_evaluation_template(text,date,date,text,text,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.create_system_log(p_user_id text DEFAULT NULL::text, p_user_name text DEFAULT NULL::text, p_user_role text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_module text DEFAULT NULL::text, p_record_id text DEFAULT NULL::text, p_record_table text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_old_data jsonb DEFAULT NULL::jsonb, p_new_data jsonb DEFAULT NULL::jsonb, p_ip_address text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_log_id text;
begin
  insert into public.system_logs (
    user_id,
    user_name,
    user_role,
    action,
    module,
    record_id,
    record_table,
    description,
    old_data,
    new_data,
    ip_address,
    user_agent
  )
  values (
    p_user_id,
    p_user_name,
    p_user_role,
    coalesce(p_action, 'Unknown Action'),
    coalesce(p_module, 'Unknown Module'),
    p_record_id,
    p_record_table,
    p_description,
    p_old_data,
    p_new_data,
    p_ip_address,
    p_user_agent
  )
  returning log_id into v_log_id;

  return v_log_id;
end;
$function$
;
revoke all on function public.create_system_log(text,text,text,text,text,text,text,text,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_system_log(text,text,text,text,text,text,text,text,jsonb,jsonb,text,text) to service_role;
grant execute on function public.create_system_log(text,text,text,text,text,text,text,text,jsonb,jsonb,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.generate_dss_results_from_evaluations(p_period_start date, p_period_end date, p_period_label text DEFAULT NULL::text, p_generated_by_user_id text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_result_id text;
  v_total_weight numeric;
begin
  -- Make sure active criteria weights are still valid
  select coalesce(sum(weight), 0)
  into v_total_weight
  from public.evaluation_criteria
  where is_active = true;

  if v_total_weight <> 100 then
    raise exception 'Cannot generate DSS results. Active criteria weights total %, not 100.', v_total_weight;
  end if;


  -- Create or update DSS result batch
  insert into public.dss_results (
    result_period_start,
    result_period_end,
    result_period_label,
    status,
    generated_by_user_id,
    generated_at
  )
  values (
    p_period_start,
    p_period_end,
    p_period_label,
    'Draft',
    p_generated_by_user_id,
    now()
  )
  on conflict (result_period_start, result_period_end)
  do update set
    result_period_label = excluded.result_period_label,
    generated_by_user_id = excluded.generated_by_user_id,
    generated_at = now(),
    updated_at = now()
  returning result_id into v_result_id;


  -- Regenerate ranking items
  delete from public.dss_result_items
  where result_id = v_result_id;


  -- Insert ranked employees based on final weighted score
  insert into public.dss_result_items (
    result_id,
    evaluation_id,
    employee_id,
    employee_name,
    position,
    outlet,
    final_weighted_score,
    rating_label,
    rank_no,
    recommendation,
    remarks
  )
  select
    v_result_id,
    ranked.evaluation_id,
    ranked.employee_id,
    ranked.employee_name,
    ranked.position,
    ranked.outlet,
    ranked.final_weighted_score,
    ranked.rating_label,
    ranked.rank_no,
    case
      when ranked.rank_no = 1 and ranked.final_weighted_score >= 85 then 'Recommended for Employee Recognition'
      when ranked.final_weighted_score >= 90 then 'Outstanding Performance'
      when ranked.final_weighted_score >= 85 then 'Highly Recommended'
      when ranked.final_weighted_score >= 80 then 'Satisfactory Performance'
      when ranked.final_weighted_score >= 75 then 'For Monitoring and Improvement'
      else 'Needs Coaching and Improvement'
    end as recommendation,
    'Generated by DSS ranking function'
  from (
    select
      ee.evaluation_id,
      ee.employee_id,
      ee.employee_name,
      ee.position,
      ee.outlet,
      coalesce(ee.final_weighted_score, 0) as final_weighted_score,
      ee.rating_label,
      row_number() over (
        order by coalesce(ee.final_weighted_score, 0) desc, ee.employee_name asc
      )::integer as rank_no
    from public.employee_evaluations ee
    where ee.evaluation_period_start = p_period_start
      and ee.evaluation_period_end = p_period_end
      and ee.status <> 'Cancelled'
      and coalesce(ee.final_weighted_score, 0) > 0
  ) ranked;


  -- Update DSS analytics summary
  update public.dss_results dr
  set
    total_employees = coalesce(stats.total_employees, 0),
    highest_score = coalesce(stats.highest_score, 0),
    average_score = coalesce(stats.average_score, 0),
    lowest_score = coalesce(stats.lowest_score, 0),
    top_employee_id = stats.top_employee_id,
    top_employee_name = stats.top_employee_name,
    updated_at = now()
  from (
    select
      result_id,
      count(*)::integer as total_employees,
      max(final_weighted_score)::numeric(8,2) as highest_score,
      avg(final_weighted_score)::numeric(8,2) as average_score,
      min(final_weighted_score)::numeric(8,2) as lowest_score,
      max(employee_id) filter (where rank_no = 1) as top_employee_id,
      max(employee_name) filter (where rank_no = 1) as top_employee_name
    from public.dss_result_items
    where result_id = v_result_id
    group by result_id
  ) stats
  where dr.result_id = stats.result_id;


  return v_result_id;
end;
$function$
;
revoke all on function public.generate_dss_results_from_evaluations(date,date,text,text) from public,anon,authenticated;
grant execute on function public.generate_dss_results_from_evaluations(date,date,text,text) to service_role;
grant execute on function public.generate_dss_results_from_evaluations(date,date,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.generate_payroll_from_attendance_summaries(p_period_start date, p_period_end date, p_cutoff_label text DEFAULT NULL::text, p_prepared_by_user_id text DEFAULT NULL::text, p_overtime_multiplier numeric DEFAULT 1.25)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_payroll_id text;
  v_safe_prepared_by_user_id text;
begin
  -- Only use prepared_by_user_id if it exists in user_accounts
  select ua.user_id
  into v_safe_prepared_by_user_id
  from public.user_accounts ua
  where ua.user_id = p_prepared_by_user_id
  limit 1;

  -- Create or update payroll summary for the selected period
  insert into public.payroll_summaries (
    period_start,
    period_end,
    cutoff_label,
    status,
    prepared_by_user_id
  )
  values (
    p_period_start,
    p_period_end,
    p_cutoff_label,
    'Draft',
    v_safe_prepared_by_user_id
  )
  on conflict (period_start, period_end)
  do update set
    cutoff_label = excluded.cutoff_label,
    prepared_by_user_id = excluded.prepared_by_user_id,
    updated_at = now()
  returning payroll_id into v_payroll_id;

  -- Regenerate payroll items for this payroll period
  delete from public.payroll_items
  where payroll_id = v_payroll_id;

  -- Create payroll items from attendance summaries
  insert into public.payroll_items (
    payroll_id,
    attendance_summary_id,
    employee_id,
    employee_name,
    position,
    outlet,
    salary_rate,
    rate_type,
    total_work_hours,
    regular_hours,
    overtime_hours,
    total_late_minutes,
    total_undertime_minutes,
    total_absent_days,
    total_incomplete_days,
    basic_pay,
    overtime_pay,
    late_deduction,
    undertime_deduction,
    absence_deduction,
    other_deductions,
    gross_pay,
    total_deductions,
    net_pay,
    remarks
  )
  select
    v_payroll_id,
    s.summary_id,
    s.employee_id,
    s.employee_name,
    s.position,
    s.outlet,

    coalesce(e.salary, 0),
    'Monthly',

    coalesce(s.total_work_hours, 0),
    coalesce(s.regular_hours, 0),
    coalesce(s.overtime_hours, 0),

    coalesce(s.total_late_minutes, 0),
    coalesce(s.total_undertime_minutes, 0),
    coalesce(s.total_absent_days, 0),
    coalesce(s.total_incomplete_days, 0),

    round(
      coalesce(s.regular_hours, 0) *
      case
        when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
        else 0
      end,
      2
    ),

    round(
      coalesce(s.overtime_hours, 0) *
      case
        when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
        else 0
      end *
      p_overtime_multiplier,
      2
    ),

    round(
      (coalesce(s.total_late_minutes, 0) / 60.0) *
      case
        when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
        else 0
      end,
      2
    ),

    round(
      (coalesce(s.total_undertime_minutes, 0) / 60.0) *
      case
        when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
        else 0
      end,
      2
    ),

    round(
      coalesce(s.total_absent_days, 0) *
      case
        when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22
        else 0
      end,
      2
    ),

    0,

    round(
      (
        coalesce(s.regular_hours, 0) *
        case
          when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
          else 0
        end
      )
      +
      (
        coalesce(s.overtime_hours, 0) *
        case
          when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
          else 0
        end *
        p_overtime_multiplier
      ),
      2
    ),

    round(
      (
        (coalesce(s.total_late_minutes, 0) / 60.0) *
        case
          when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
          else 0
        end
      )
      +
      (
        (coalesce(s.total_undertime_minutes, 0) / 60.0) *
        case
          when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
          else 0
        end
      )
      +
      (
        coalesce(s.total_absent_days, 0) *
        case
          when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22
          else 0
        end
      ),
      2
    ),

    round(
      (
        (
          coalesce(s.regular_hours, 0) *
          case
            when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
            else 0
          end
        )
        +
        (
          coalesce(s.overtime_hours, 0) *
          case
            when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
            else 0
          end *
          p_overtime_multiplier
        )
      )
      -
      (
        (
          (coalesce(s.total_late_minutes, 0) / 60.0) *
          case
            when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
            else 0
          end
        )
        +
        (
          (coalesce(s.total_undertime_minutes, 0) / 60.0) *
          case
            when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22 / 8
            else 0
          end
        )
        +
        (
          coalesce(s.total_absent_days, 0) *
          case
            when coalesce(e.salary, 0) > 0 then coalesce(e.salary, 0) / 22
            else 0
          end
        )
      ),
      2
    ),

    'Generated from attendance summary'

  from public.attendance_summaries s
  left join public.employees e
    on e.employee_id = s.employee_id
  where s.period_start = p_period_start
    and s.period_end = p_period_end;

  -- Update payroll summary totals
  update public.payroll_summaries ps
  set
    total_employees = coalesce(t.total_employees, 0),
    total_regular_hours = coalesce(t.total_regular_hours, 0),
    total_overtime_hours = coalesce(t.total_overtime_hours, 0),
    total_late_minutes = coalesce(t.total_late_minutes, 0),
    total_undertime_minutes = coalesce(t.total_undertime_minutes, 0),
    total_gross_pay = coalesce(t.total_gross_pay, 0),
    total_deductions = coalesce(t.total_deductions, 0),
    total_overtime_pay = coalesce(t.total_overtime_pay, 0),
    total_net_pay = coalesce(t.total_net_pay, 0),
    updated_at = now()
  from (
    select
      payroll_id,
      count(*)::integer as total_employees,
      coalesce(sum(regular_hours), 0)::numeric(10,2) as total_regular_hours,
      coalesce(sum(overtime_hours), 0)::numeric(10,2) as total_overtime_hours,
      coalesce(sum(total_late_minutes), 0)::integer as total_late_minutes,
      coalesce(sum(total_undertime_minutes), 0)::integer as total_undertime_minutes,
      coalesce(sum(gross_pay), 0)::numeric(12,2) as total_gross_pay,
      coalesce(sum(total_deductions), 0)::numeric(12,2) as total_deductions,
      coalesce(sum(overtime_pay), 0)::numeric(12,2) as total_overtime_pay,
      coalesce(sum(net_pay), 0)::numeric(12,2) as total_net_pay
    from public.payroll_items
    where payroll_id = v_payroll_id
    group by payroll_id
  ) t
  where ps.payroll_id = t.payroll_id;

  return v_payroll_id;
end;
$function$
;
revoke all on function public.generate_payroll_from_attendance_summaries(date,date,text,text,numeric) from public,anon,authenticated;
grant execute on function public.generate_payroll_from_attendance_summaries(date,date,text,text,numeric) to service_role;
grant execute on function public.generate_payroll_from_attendance_summaries(date,date,text,text,numeric) to authenticated;
CREATE OR REPLACE FUNCTION public.hris_has_role(allowed text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_accounts a where a.is_active = true
    and (a.auth_user_id = auth.uid() or (a.auth_user_id is null and lower(a.email) = lower(auth.jwt()->>'email')))
    and a.role = any(allowed));
$function$
;
revoke all on function public.hris_has_role(text[]) from public,anon,authenticated;
grant execute on function public.hris_has_role(text[]) to service_role;
grant execute on function public.hris_has_role(text[]) to authenticated;
CREATE OR REPLACE FUNCTION public.recalculate_employee_evaluation(p_evaluation_id text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_total_weight numeric;
  v_final_score numeric;
  v_total_raw_score numeric;
begin
  -- Check if the criteria used in this evaluation total 100%
  select coalesce(sum(criteria_weight), 0)
  into v_total_weight
  from public.employee_evaluation_scores
  where evaluation_id = p_evaluation_id;

  if v_total_weight <> 100 then
    raise exception 'Evaluation cannot be computed. Criteria weights total %, not 100.', v_total_weight;
  end if;

  -- Compute weighted score per criterion
  update public.employee_evaluation_scores
  set
    weighted_score = round(
      case
        when max_score > 0 then (raw_score / max_score) * criteria_weight
        else 0
      end,
      2
    ),
    updated_at = now()
  where evaluation_id = p_evaluation_id;

  -- Get final scores
  select
    coalesce(sum(weighted_score), 0),
    coalesce(avg(raw_score), 0)
  into
    v_final_score,
    v_total_raw_score
  from public.employee_evaluation_scores
  where evaluation_id = p_evaluation_id;

  -- Update main evaluation record
  update public.employee_evaluations
  set
    total_raw_score = round(v_total_raw_score, 2),
    final_weighted_score = round(v_final_score, 2),
    rating_label =
      case
        when v_final_score >= 90 then 'Outstanding'
        when v_final_score >= 85 then 'Very Satisfactory'
        when v_final_score >= 80 then 'Satisfactory'
        when v_final_score >= 75 then 'Fair'
        else 'Needs Improvement'
      end,
    updated_at = now()
  where evaluation_id = p_evaluation_id;
end;
$function$
;
revoke all on function public.recalculate_employee_evaluation(text) from public,anon,authenticated;
grant execute on function public.recalculate_employee_evaluation(text) to service_role;
grant execute on function public.recalculate_employee_evaluation(text) to authenticated;
CREATE OR REPLACE FUNCTION public.refresh_attendance_summaries(p_period_start date, p_period_end date, p_period_type text DEFAULT 'Custom'::text, p_generated_by_user_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_safe_generated_by_user_id text;
begin
  -- Only use generated_by_user_id if it exists in user_accounts
  select ua.user_id
  into v_safe_generated_by_user_id
  from public.user_accounts ua
  where ua.user_id = p_generated_by_user_id
  limit 1;

  insert into public.attendance_summaries (
    employee_id,
    employee_name,
    position,
    outlet,
    period_start,
    period_end,
    period_type,
    total_attendance_days,
    total_present_days,
    total_absent_days,
    total_incomplete_days,
    total_late_count,
    total_undertime_count,
    total_overtime_count,
    total_late_minutes,
    total_undertime_minutes,
    total_overtime_minutes,
    total_work_hours,
    regular_hours,
    overtime_hours,
    source_log_ids,
    status,
    generated_by_user_id
  )
  select
    al.employee_id,
    coalesce(
      max(al.employee_name),
      max(e.first_name || ' ' || e.last_name)
    ) as employee_name,
    max(e.position) as position,
    max(e.outlet) as outlet,
    p_period_start,
    p_period_end,
    p_period_type,

    count(distinct al.attendance_date)::integer,

    count(distinct al.attendance_date) filter (
      where coalesce(al.is_absent, false) = false
    )::integer,

    count(distinct al.attendance_date) filter (
      where coalesce(al.is_absent, false) = true
    )::integer,

    count(distinct al.attendance_date) filter (
      where coalesce(al.is_incomplete, false) = true
    )::integer,

    sum(case when coalesce(al.is_late, false) then 1 else 0 end)::integer,
    sum(case when coalesce(al.is_undertime, false) then 1 else 0 end)::integer,
    sum(case when coalesce(al.is_overtime, false) then 1 else 0 end)::integer,

    coalesce(sum(al.late_minutes), 0)::integer,
    coalesce(sum(al.undertime_minutes), 0)::integer,
    coalesce(sum(al.overtime_minutes), 0)::integer,

    coalesce(sum(al.total_hours), 0)::numeric(8,2),

    greatest(
      coalesce(sum(al.total_hours), 0) - (coalesce(sum(al.overtime_minutes), 0) / 60.0),
      0
    )::numeric(8,2),

    (coalesce(sum(al.overtime_minutes), 0) / 60.0)::numeric(8,2),

    coalesce(jsonb_agg(al.log_id order by al.attendance_date), '[]'::jsonb),

    'Draft',
    v_safe_generated_by_user_id

  from public.attendance_logs al
  left join public.employees e
    on e.employee_id = al.employee_id
  where al.attendance_date between p_period_start and p_period_end
    and al.employee_id is not null
  group by al.employee_id

  on conflict (employee_id, period_start, period_end)
  do update set
    employee_name = excluded.employee_name,
    position = excluded.position,
    outlet = excluded.outlet,
    period_type = excluded.period_type,
    total_attendance_days = excluded.total_attendance_days,
    total_present_days = excluded.total_present_days,
    total_absent_days = excluded.total_absent_days,
    total_incomplete_days = excluded.total_incomplete_days,
    total_late_count = excluded.total_late_count,
    total_undertime_count = excluded.total_undertime_count,
    total_overtime_count = excluded.total_overtime_count,
    total_late_minutes = excluded.total_late_minutes,
    total_undertime_minutes = excluded.total_undertime_minutes,
    total_overtime_minutes = excluded.total_overtime_minutes,
    total_work_hours = excluded.total_work_hours,
    regular_hours = excluded.regular_hours,
    overtime_hours = excluded.overtime_hours,
    source_log_ids = excluded.source_log_ids,
    generated_by_user_id = excluded.generated_by_user_id,
    updated_at = now();
end;
$function$
;
revoke all on function public.refresh_attendance_summaries(date,date,text,text) from public,anon,authenticated;
grant execute on function public.refresh_attendance_summaries(date,date,text,text) to service_role;
grant execute on function public.refresh_attendance_summaries(date,date,text,text) to authenticated;
CREATE OR REPLACE FUNCTION public.register_applicant_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.raw_user_meta_data->>'registration_kind' = 'applicant' then
    if coalesce(trim(new.raw_user_meta_data->'applicant_profile'->>'firstName'), '') = ''
      or coalesce(trim(new.raw_user_meta_data->'applicant_profile'->>'lastName'), '') = ''
      or coalesce(new.raw_user_meta_data->'applicant_profile'->>'birthdate', '') = '' then
      raise exception 'First name, last name and date of birth are required.';
    end if;
    insert into public.applicant_profiles(auth_user_id,profile)
      values(new.id, new.raw_user_meta_data->'applicant_profile');
  end if;
  return new;
end; $function$
;
revoke all on function public.register_applicant_profile() from public,anon,authenticated;
grant execute on function public.register_applicant_profile() to service_role;
grant execute on function public.register_applicant_profile() to authenticated;
CREATE OR REPLACE FUNCTION public.set_attendance_logs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_attendance_logs_updated_at() from public,anon,authenticated;
grant execute on function public.set_attendance_logs_updated_at() to service_role;
grant execute on function public.set_attendance_logs_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_attendance_summaries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_attendance_summaries_updated_at() from public,anon,authenticated;
grant execute on function public.set_attendance_summaries_updated_at() to service_role;
grant execute on function public.set_attendance_summaries_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_attendance_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_attendance_updated_at() from public,anon,authenticated;
grant execute on function public.set_attendance_updated_at() to service_role;
grant execute on function public.set_attendance_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_dss_result_items_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_dss_result_items_updated_at() from public,anon,authenticated;
grant execute on function public.set_dss_result_items_updated_at() to service_role;
grant execute on function public.set_dss_result_items_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_dss_results_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_dss_results_updated_at() from public,anon,authenticated;
grant execute on function public.set_dss_results_updated_at() to service_role;
grant execute on function public.set_dss_results_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_employee_evaluation_scores_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_employee_evaluation_scores_updated_at() from public,anon,authenticated;
grant execute on function public.set_employee_evaluation_scores_updated_at() to service_role;
grant execute on function public.set_employee_evaluation_scores_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_employee_evaluations_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_employee_evaluations_updated_at() from public,anon,authenticated;
grant execute on function public.set_employee_evaluations_updated_at() to service_role;
grant execute on function public.set_employee_evaluations_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_employee_requests_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_employee_requests_updated_at() from public,anon,authenticated;
grant execute on function public.set_employee_requests_updated_at() to service_role;
grant execute on function public.set_employee_requests_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_evaluation_criteria_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_evaluation_criteria_updated_at() from public,anon,authenticated;
grant execute on function public.set_evaluation_criteria_updated_at() to service_role;
grant execute on function public.set_evaluation_criteria_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_payroll_items_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_payroll_items_updated_at() from public,anon,authenticated;
grant execute on function public.set_payroll_items_updated_at() to service_role;
grant execute on function public.set_payroll_items_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_payroll_summaries_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
revoke all on function public.set_payroll_summaries_updated_at() from public,anon,authenticated;
grant execute on function public.set_payroll_summaries_updated_at() to service_role;
grant execute on function public.set_payroll_summaries_updated_at() to authenticated;
CREATE OR REPLACE FUNCTION public.set_user_password(p_user_id text, p_new_password text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  update public.user_accounts
  set
    password_hash = crypt(p_new_password, gen_salt('bf')),
    password = null,
    password_changed_at = now(),
    failed_login_attempts = 0,
    locked_until = null
  where user_id = p_user_id;
end;
$function$
;
revoke all on function public.set_user_password(text,text) from public,anon,authenticated;
grant execute on function public.set_user_password(text,text) to service_role;
CREATE OR REPLACE FUNCTION public.submit_profile_application(p_application jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare next_number bigint; tracking_id text; allowed jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.applicant_profiles where auth_user_id=auth.uid()) then
    raise exception 'Please register and sign in before applying.';
  end if;
  if exists(select 1 from public.user_accounts where auth_user_id=auth.uid()) then raise exception 'This login is already an employee account.'; end if;
  perform pg_advisory_xact_lock(778812);
  select coalesce(max(substring(applicant_id from '[0-9]+$')::bigint),0)+1 into next_number
  from public.applicants where applicant_id ~ ('^APP-'||to_char(now(),'YYYY')||'-[0-9]{4,9}$');
  tracking_id := 'APP-'||to_char(now(),'YYYY')||'-'||lpad(next_number::text,greatest(4,length(next_number::text)), '0');
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into allowed from jsonb_each(p_application)
  where key=any(array['name','first_name','middle_name','last_name','suffix','gender','civil_status','birthdate','birthplace','height','weight','phone_number','address','position_applied','education','experience','cover_letter','tin','sss','philhealth','pagibig','emergency_contact','resume_file_name','resume_file_data','supporting_documents','supporting_document_files']);
  insert into public.applicants select * from jsonb_populate_record(null::public.applicants,
    allowed || jsonb_build_object('id',gen_random_uuid(),'applicant_id',tracking_id,'auth_user_id',auth.uid(),'email',auth.jwt()->>'email','status','Submitted','created_at',now(),'updated_at',now(),'is_archived',false,'has_resume',false,'has_birth_cert',false,'has_tor',false,'has_med_cert',false));
  return tracking_id;
end; $function$
;
revoke all on function public.submit_profile_application(jsonb) from public,anon,authenticated;
grant execute on function public.submit_profile_application(jsonb) to service_role;
grant execute on function public.submit_profile_application(jsonb) to authenticated;
CREATE OR REPLACE FUNCTION public.validate_active_leave_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op='UPDATE' then
    if new.leave_type is not distinct from old.leave_type and new.request_type is not distinct from old.request_type then return new; end if;
  end if;
  if new.request_type='Leave' and not exists(select 1 from public.leave_types where name=new.leave_type and is_active=true) then
    raise exception 'This leave type is no longer available. Please choose an active leave type.';
  end if;
  return new;
end; $function$
;
revoke all on function public.validate_active_leave_type() from public,anon,authenticated;
grant execute on function public.validate_active_leave_type() to service_role;
grant execute on function public.validate_active_leave_type() to authenticated;
CREATE OR REPLACE FUNCTION public.verify_user_login(p_email text, p_password text)
 RETURNS TABLE(id uuid, user_id text, employee_id text, applicant_id text, first_name text, middle_name text, last_name text, full_name text, email text, role text, outlet text, is_active boolean, login_success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  return query
  select
    ua.id,
    ua.user_id,
    ua.employee_id,
    ua.applicant_id,
    ua.first_name,
    ua.middle_name,
    ua.last_name,
    ua.full_name,
    ua.email,
    ua.role,
    ua.outlet,
    ua.is_active,
    (
      ua.is_active = true
      and ua.password_hash is not null
      and ua.password_hash = extensions.crypt(p_password, ua.password_hash)
      and (
        ua.locked_until is null
        or ua.locked_until < now()
      )
    ) as login_success,
    case
      when ua.is_active = false then 'Account is inactive.'
      when ua.locked_until is not null and ua.locked_until >= now() then 'Account is temporarily locked.'
      when ua.password_hash is not null and ua.password_hash = extensions.crypt(p_password, ua.password_hash) then 'Login successful.'
      else 'Invalid email or password.'
    end as message
  from public.user_accounts ua
  where lower(ua.email) = lower(p_email)
  limit 1;
end;
$function$
;
revoke all on function public.verify_user_login(text,text) from public,anon,authenticated;
grant execute on function public.verify_user_login(text,text) to service_role;
CREATE INDEX applicants_archive_status_created_at_idx ON public.applicants USING btree (is_archived, status, created_at DESC);
CREATE INDEX applicants_auth_user_id_idx ON public.applicants USING btree (auth_user_id);
CREATE INDEX attendance_import_batches_created_at_idx ON public.attendance_import_batches USING btree (created_at);
CREATE INDEX attendance_logs_attendance_date_idx ON public.attendance_logs USING btree (attendance_date);
CREATE INDEX attendance_logs_batch_id_idx ON public.attendance_logs USING btree (batch_id);
CREATE INDEX attendance_logs_biometric_user_id_idx ON public.attendance_logs USING btree (biometric_user_id);
CREATE INDEX attendance_logs_employee_id_idx ON public.attendance_logs USING btree (employee_id);
CREATE INDEX attendance_logs_source_idx ON public.attendance_logs USING btree (source);
CREATE INDEX attendance_logs_validation_status_idx ON public.attendance_logs USING btree (validation_status);
CREATE INDEX attendance_summaries_employee_id_idx ON public.attendance_summaries USING btree (employee_id);
CREATE INDEX attendance_summaries_outlet_idx ON public.attendance_summaries USING btree (outlet);
CREATE INDEX attendance_summaries_period_end_idx ON public.attendance_summaries USING btree (period_end);
CREATE INDEX attendance_summaries_period_start_idx ON public.attendance_summaries USING btree (period_start);
CREATE INDEX attendance_summaries_status_idx ON public.attendance_summaries USING btree (status);
CREATE INDEX dss_result_items_employee_id_idx ON public.dss_result_items USING btree (employee_id);
CREATE INDEX dss_result_items_rank_no_idx ON public.dss_result_items USING btree (rank_no);
CREATE INDEX dss_result_items_result_id_idx ON public.dss_result_items USING btree (result_id);
CREATE INDEX dss_results_period_end_idx ON public.dss_results USING btree (result_period_end);
CREATE INDEX dss_results_period_start_idx ON public.dss_results USING btree (result_period_start);
CREATE INDEX dss_results_status_idx ON public.dss_results USING btree (status);
CREATE INDEX employee_evaluation_scores_criteria_id_idx ON public.employee_evaluation_scores USING btree (criteria_id);
CREATE INDEX employee_evaluation_scores_evaluation_id_idx ON public.employee_evaluation_scores USING btree (evaluation_id);
CREATE INDEX employee_evaluations_employee_id_idx ON public.employee_evaluations USING btree (employee_id);
CREATE INDEX employee_evaluations_period_end_idx ON public.employee_evaluations USING btree (evaluation_period_end);
CREATE INDEX employee_evaluations_period_start_idx ON public.employee_evaluations USING btree (evaluation_period_start);
CREATE INDEX employee_evaluations_status_idx ON public.employee_evaluations USING btree (status);
CREATE INDEX employee_leave_balances_employee_id_idx ON public.employee_leave_balances USING btree (employee_id);
CREATE INDEX employee_requests_created_at_idx ON public.employee_requests USING btree (created_at);
CREATE INDEX employee_requests_employee_id_idx ON public.employee_requests USING btree (employee_id);
CREATE INDEX employee_requests_hr_status_idx ON public.employee_requests USING btree (hr_status);
CREATE INDEX employee_requests_request_type_idx ON public.employee_requests USING btree (request_type);
CREATE INDEX employee_requests_start_date_idx ON public.employee_requests USING btree (start_date);
CREATE INDEX employee_requests_status_idx ON public.employee_requests USING btree (status);
CREATE INDEX employee_requests_supervisor_status_idx ON public.employee_requests USING btree (supervisor_status);
CREATE UNIQUE INDEX employees_biometric_user_id_uidx ON public.employees USING btree (biometric_user_id) WHERE (biometric_user_id IS NOT NULL);
CREATE UNIQUE INDEX evaluation_criteria_active_name_uidx ON public.evaluation_criteria USING btree (lower((criteria_name)::text)) WHERE (is_active = true);
CREATE INDEX evaluation_criteria_category_idx ON public.evaluation_criteria USING btree (category);
CREATE INDEX evaluation_criteria_is_active_idx ON public.evaluation_criteria USING btree (is_active);
CREATE UNIQUE INDEX leave_types_name_key ON public.leave_types USING btree (lower(TRIM(BOTH FROM name)));
CREATE INDEX payroll_items_employee_id_idx ON public.payroll_items USING btree (employee_id);
CREATE INDEX payroll_items_outlet_idx ON public.payroll_items USING btree (outlet);
CREATE INDEX payroll_items_payroll_id_idx ON public.payroll_items USING btree (payroll_id);
CREATE INDEX payroll_items_payslip_details_gin_idx ON public.payroll_items USING gin (payslip_details);
CREATE INDEX payroll_summaries_period_end_idx ON public.payroll_summaries USING btree (period_end);
CREATE INDEX payroll_summaries_period_start_idx ON public.payroll_summaries USING btree (period_start);
CREATE INDEX payroll_summaries_status_idx ON public.payroll_summaries USING btree (status);
CREATE INDEX system_logs_action_idx ON public.system_logs USING btree (action);
CREATE INDEX system_logs_created_at_idx ON public.system_logs USING btree (created_at);
CREATE INDEX system_logs_module_idx ON public.system_logs USING btree (module);
CREATE INDEX system_logs_record_table_idx ON public.system_logs USING btree (record_table);
CREATE INDEX system_logs_user_id_idx ON public.system_logs USING btree (user_id);
CREATE INDEX system_logs_user_role_idx ON public.system_logs USING btree (user_role);
CREATE UNIQUE INDEX user_accounts_auth_user_id_key ON public.user_accounts USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);
create policy "Applicants read own reusable profile" on "public"."applicant_profiles" as PERMISSIVE for SELECT to "authenticated" using ((auth_user_id = auth.uid()));
create policy "Applicants update own reusable profile" on "public"."applicant_profiles" as PERMISSIVE for UPDATE to "authenticated" using ((auth_user_id = auth.uid())) with check ((auth_user_id = auth.uid()));
create policy "Applicants read own applications" on "public"."applicants" as PERMISSIVE for SELECT to "authenticated" using ((auth_user_id = auth.uid()));
create policy "Applicants submit own applications" on "public"."applicants" as PERMISSIVE for INSERT to "authenticated" with check (((auth_user_id = auth.uid()) AND (status = 'Submitted'::text) AND (EXISTS ( SELECT 1
   FROM applicant_profiles
  WHERE (applicant_profiles.auth_user_id = auth.uid())))));
create policy "Employees read linked application" on "public"."applicants" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM (employees e
     JOIN user_accounts a ON ((a.employee_id = e.employee_id)))
  WHERE ((e.applicant_id = applicants.applicant_id) AND (a.role = 'employee'::text) AND (a.is_active = true) AND ((a.auth_user_id = auth.uid()) OR ((a.auth_user_id IS NULL) AND (lower(a.email) = lower((auth.jwt() ->> 'email'::text)))))))));
create policy "Staff manage applications" on "public"."applicants" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text]));
create policy "Internal account access" on "public"."attendance_import_batches" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."attendance_import_batches" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."attendance_logs" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."attendance_logs" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."attendance_summaries" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."attendance_summaries" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."dss_result_items" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."dss_result_items" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."dss_results" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."dss_results" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."employee_evaluation_scores" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."employee_evaluation_scores" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."employee_evaluations" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."employee_evaluations" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Employees read own leave balance" on "public"."employee_leave_balances" as PERMISSIVE for SELECT to "authenticated" using ((EXISTS ( SELECT 1
   FROM user_accounts a
  WHERE ((a.employee_id = employee_leave_balances.employee_id) AND (a.auth_user_id = auth.uid()) AND (a.is_active = true)))));
create policy "HR manages leave balances" on "public"."employee_leave_balances" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text])) with check (hris_has_role(ARRAY['hr_admin'::text]));
create policy "Staff read leave balances" on "public"."employee_leave_balances" as PERMISSIVE for SELECT to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text]));
create policy "Internal account access" on "public"."employee_requests" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."employee_requests" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."employees" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."employees" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."evaluation_criteria" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."evaluation_criteria" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Staff read leave types" on "public"."leave_types" as PERMISSIVE for SELECT to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Super Admin adds leave types" on "public"."leave_types" as PERMISSIVE for INSERT to "authenticated" with check (hris_has_role(ARRAY['hr_admin'::text]));
create policy "Super Admin updates leave types" on "public"."leave_types" as PERMISSIVE for UPDATE to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text])) with check (hris_has_role(ARRAY['hr_admin'::text]));
create policy "Internal account access" on "public"."notifications" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."notifications" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."payroll_items" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."payroll_items" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."payroll_summaries" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."payroll_summaries" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."schedule" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."schedule" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Internal account access" on "public"."system_logs" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "Require internal account" on "public"."system_logs" as RESTRICTIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text])) with check (hris_has_role(ARRAY['hr_admin'::text, 'general_manager'::text, 'accounting_finance'::text, 'supervisor'::text, 'employee'::text]));
create policy "HR manage accounts" on "public"."user_accounts" as PERMISSIVE for ALL to "authenticated" using (hris_has_role(ARRAY['hr_admin'::text])) with check (hris_has_role(ARRAY['hr_admin'::text]));
create policy "Staff read account directory" on "public"."user_accounts" as PERMISSIVE for SELECT to "authenticated" using (hris_has_role(ARRAY['general_manager'::text, 'accounting_finance'::text, 'supervisor'::text]));
create policy "Users read own account" on "public"."user_accounts" as PERMISSIVE for SELECT to "authenticated" using (((auth_user_id = auth.uid()) OR ((auth_user_id IS NULL) AND (lower(email) = lower((auth.jwt() ->> 'email'::text))))));
create policy "Payslip admins can update files" on "storage"."objects" as PERMISSIVE for UPDATE to "authenticated" using (((bucket_id = 'payslips'::text) AND (EXISTS ( SELECT 1
   FROM user_accounts account
  WHERE ((account.is_active IS TRUE) AND ((account.auth_user_id = ( SELECT auth.uid() AS uid)) OR (lower(account.email) = lower(( SELECT (auth.jwt() ->> 'email'::text))))) AND (lower(account.role) = ANY (ARRAY['hr'::text, 'hr_admin'::text, 'admin'::text, 'accounting'::text, 'accounting_finance'::text, 'finance'::text, 'gm'::text, 'general_manager'::text]))))))) with check (((bucket_id = 'payslips'::text) AND (EXISTS ( SELECT 1
   FROM user_accounts account
  WHERE ((account.is_active IS TRUE) AND ((account.auth_user_id = ( SELECT auth.uid() AS uid)) OR (lower(account.email) = lower(( SELECT (auth.jwt() ->> 'email'::text))))) AND (lower(account.role) = ANY (ARRAY['hr'::text, 'hr_admin'::text, 'admin'::text, 'accounting'::text, 'accounting_finance'::text, 'finance'::text, 'gm'::text, 'general_manager'::text])))))));
create policy "Payslip admins can upload files" on "storage"."objects" as PERMISSIVE for INSERT to "authenticated" with check (((bucket_id = 'payslips'::text) AND (EXISTS ( SELECT 1
   FROM user_accounts account
  WHERE ((account.is_active IS TRUE) AND ((account.auth_user_id = ( SELECT auth.uid() AS uid)) OR (lower(account.email) = lower(( SELECT (auth.jwt() ->> 'email'::text))))) AND (lower(account.role) = ANY (ARRAY['hr'::text, 'hr_admin'::text, 'admin'::text, 'accounting'::text, 'accounting_finance'::text, 'finance'::text, 'gm'::text, 'general_manager'::text])))))));
create policy "Payslip users can read scoped files" on "storage"."objects" as PERMISSIVE for SELECT to "authenticated" using (((bucket_id = 'payslips'::text) AND (EXISTS ( SELECT 1
   FROM user_accounts account
  WHERE ((account.is_active IS TRUE) AND ((account.auth_user_id = ( SELECT auth.uid() AS uid)) OR (lower(account.email) = lower(( SELECT (auth.jwt() ->> 'email'::text))))) AND ((lower(account.role) = ANY (ARRAY['hr'::text, 'hr_admin'::text, 'admin'::text, 'accounting'::text, 'accounting_finance'::text, 'finance'::text, 'gm'::text, 'general_manager'::text])) OR ((account.employee_id IS NOT NULL) AND ((storage.foldername(objects.name))[1] = account.employee_id))))))));
grant INSERT,SELECT,UPDATE,DELETE on public."applicant_profiles" to authenticated;
grant all on public."applicant_profiles" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."applicants" to authenticated;
grant all on public."applicants" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."attendance_import_batches" to authenticated;
grant all on public."attendance_import_batches" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."attendance_logs" to authenticated;
grant all on public."attendance_logs" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."attendance_summaries" to authenticated;
grant all on public."attendance_summaries" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."dss_result_items" to authenticated;
grant all on public."dss_result_items" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."dss_results" to authenticated;
grant all on public."dss_results" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."employee_evaluation_scores" to authenticated;
grant all on public."employee_evaluation_scores" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."employee_evaluations" to authenticated;
grant all on public."employee_evaluations" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."employee_leave_balances" to authenticated;
grant all on public."employee_leave_balances" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."employee_requests" to authenticated;
grant all on public."employee_requests" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."employees" to authenticated;
grant all on public."employees" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."evaluation_criteria" to authenticated;
grant all on public."evaluation_criteria" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."job_postings" to authenticated;
grant all on public."job_postings" to service_role;
grant INSERT,SELECT,UPDATE on public."leave_types" to authenticated;
grant all on public."leave_types" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."notifications" to authenticated;
grant all on public."notifications" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."payroll_items" to authenticated;
grant all on public."payroll_items" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."payroll_summaries" to authenticated;
grant all on public."payroll_summaries" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."schedule" to authenticated;
grant all on public."schedule" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."system_logs" to authenticated;
grant all on public."system_logs" to service_role;
grant INSERT,SELECT,UPDATE,DELETE on public."user_accounts" to authenticated;
grant all on public."user_accounts" to service_role;
create policy "Anyone reads job postings" on public.job_postings for select to anon using (true);
grant select on public.job_postings to anon;
create policy "HR manages job postings" on public.job_postings for all to authenticated using (public.hris_has_role(array['hr_admin','general_manager'])) with check (public.hris_has_role(array['hr_admin','general_manager']));
grant usage,select on sequence public.schedule_schedule_id_seq to authenticated,service_role;
select setval('public.schedule_schedule_id_seq', 1, false);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('payslips','payslips',false,10485760,array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
CREATE TRIGGER bind_applicant_identity BEFORE INSERT ON public.applicants FOR EACH ROW EXECUTE FUNCTION bind_applicant_identity();
CREATE TRIGGER register_applicant_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION register_applicant_profile();
CREATE TRIGGER trg_attendance_logs_updated_at BEFORE UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION set_attendance_logs_updated_at();
CREATE TRIGGER trg_attendance_summaries_updated_at BEFORE UPDATE ON public.attendance_summaries FOR EACH ROW EXECUTE FUNCTION set_attendance_summaries_updated_at();
CREATE TRIGGER trg_dss_result_items_updated_at BEFORE UPDATE ON public.dss_result_items FOR EACH ROW EXECUTE FUNCTION set_dss_result_items_updated_at();
CREATE TRIGGER trg_dss_results_updated_at BEFORE UPDATE ON public.dss_results FOR EACH ROW EXECUTE FUNCTION set_dss_results_updated_at();
CREATE TRIGGER trg_employee_evaluation_scores_updated_at BEFORE UPDATE ON public.employee_evaluation_scores FOR EACH ROW EXECUTE FUNCTION set_employee_evaluation_scores_updated_at();
CREATE TRIGGER trg_employee_evaluations_updated_at BEFORE UPDATE ON public.employee_evaluations FOR EACH ROW EXECUTE FUNCTION set_employee_evaluations_updated_at();
CREATE TRIGGER trg_employee_requests_updated_at BEFORE UPDATE ON public.employee_requests FOR EACH ROW EXECUTE FUNCTION set_employee_requests_updated_at();
CREATE TRIGGER trg_evaluation_criteria_updated_at BEFORE UPDATE ON public.evaluation_criteria FOR EACH ROW EXECUTE FUNCTION set_evaluation_criteria_updated_at();
CREATE TRIGGER trg_payroll_items_updated_at BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION set_payroll_items_updated_at();
CREATE TRIGGER trg_payroll_summaries_updated_at BEFORE UPDATE ON public.payroll_summaries FOR EACH ROW EXECUTE FUNCTION set_payroll_summaries_updated_at();
CREATE TRIGGER validate_active_leave_type BEFORE INSERT OR UPDATE OF leave_type, request_type ON public.employee_requests FOR EACH ROW EXECUTE FUNCTION validate_active_leave_type();
notify pgrst,'reload schema';
