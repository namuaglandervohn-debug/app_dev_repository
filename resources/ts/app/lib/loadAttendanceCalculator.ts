import { supabase } from './supabaseClient';
import type { PostgrestResponse } from '@supabase/supabase-js';
import { createAttendanceCalculator, type ApprovedTimeRequest, type AttendanceSchedule } from './scheduledAttendance';

export const attendancePunchFields = 'employee_id,attendance_date,time_in,time_out,work_intervals,source,remarks,total_hours,late_minutes,undertime_minutes,overtime_minutes,is_absent,is_incomplete,is_late,is_undertime,is_overtime';

export async function loadAttendanceCalculator(employeeId?: string, start?: string, end?: string) {
  const schedules: AttendanceSchedule[] = [];
  const requests: ApprovedTimeRequest[] = [];
  const pageSize = 500;
  let moreSchedules = true;
  let moreRequests = true;
  for (let offset = 0; moreSchedules || moreRequests; offset += pageSize) {
    const rangeEnd = offset + pageSize - 1;
    let scheduleQuery = supabase.from('schedule')
      .select('employee_id,week,break_time,status,monday,tuesday,wednesday,thursday,friday,saturday,sunday')
      .order('schedule_id', { ascending: false }).range(offset, rangeEnd);
    let requestQuery = supabase.from('employee_requests')
      .select('employee_id,request_type,start_date,end_date,start_time,end_time')
      .eq('status', 'Approved').eq('hr_status', 'Approved').in('request_type', ['Overtime', 'Undertime'])
      .order('id').range(offset, rangeEnd);
    if (employeeId) {
      scheduleQuery = scheduleQuery.eq('employee_id', employeeId);
      requestQuery = requestQuery.eq('employee_id', employeeId);
    }
    if (start) requestQuery = requestQuery.gte('end_date', start);
    if (end) requestQuery = requestQuery.lte('start_date', end);
    const [schedulePage, requestPage]: [PostgrestResponse<AttendanceSchedule> | null, PostgrestResponse<ApprovedTimeRequest> | null] = await Promise.all([
      moreSchedules ? scheduleQuery : null,
      moreRequests ? requestQuery : null,
    ]);
    if (schedulePage?.error) throw schedulePage.error;
    if (requestPage?.error) throw requestPage.error;
    schedules.push(...(schedulePage?.data ?? []));
    requests.push(...(requestPage?.data ?? []));
    moreSchedules = schedulePage?.data?.length === pageSize;
    moreRequests = requestPage?.data?.length === pageSize;
  }
  return createAttendanceCalculator(schedules, requests);
}
