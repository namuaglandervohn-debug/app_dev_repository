begin;

alter policy "Limit payroll summaries to employee payslips" on public.payroll_summaries
  using ((select public.hris_has_role(array['hr_admin','general_manager','accounting_finance'])));

commit;
