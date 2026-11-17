import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceCalculator, findMissingAttendance } from '../resources/ts/app/lib/scheduledAttendance.ts';
import { matchesReportOutlet } from '../resources/ts/app/lib/reportOutlet.ts';
import { NO_OUTLET } from '../resources/ts/app/lib/constants.ts';

test('missing punches need a completed published shift and exclude leave, holidays, rest days, and recorded attendance', () => {
  const employees = ['working','leave','off','recorded','draft','overnight','new'].map(employee_id => ({ employee_id, hire_date: employee_id === 'new' ? '2026-08-09' : null }));
  const schedules = employees.map(({employee_id}) => ({
    employee_id, week:'August 3-9, 2026', break_time:null, status: employee_id === 'draft' ? 'Draft' : 'Published',
    saturday: employee_id === 'off' ? 'Rest Day' : employee_id === 'overnight' ? '22:00 - 06:00' : '08:00 - 17:00',
  }));
  const leave = [{employee_id:'leave',request_type:'Leave',start_date:'2026-08-08',end_date:'2026-08-08',start_time:null,end_time:null}];
  const calculate = createAttendanceCalculator(schedules, leave);
  const recorded = [{employee_id:'recorded',attendance_date:'2026-08-08'}];
  assert.deepEqual(findMissingAttendance(calculate, employees, '2026-08-08', '2026-08-08', recorded, new Set(), '2026-08-09', 180)
    .map(entry => entry.employeeId), ['working']);
  assert.deepEqual(findMissingAttendance(calculate, employees, '2026-08-08', '2026-08-08', recorded, new Set(), '2026-08-09', 360)
    .map(entry => entry.employeeId), ['working','overnight']);
  assert.deepEqual(findMissingAttendance(calculate, employees, '2026-08-08', '2026-08-08', recorded, new Set(['2026-08-08']), '2026-08-09'), []);
  assert.equal(calculate({...leave[0],attendance_date:'2026-08-08',is_absent:true}).is_absent, false);
});

test('outlet filtering covers branch-specific reports and leaves organization-wide reports eligible', () => {
  for (const type of ['employees','schedules','attendance','attendanceLogs','payroll','evaluations','requests']) {
    assert.ok(matchesReportOutlet(type, ' Buenaventura Cafe ', 'Buenaventura Café'));
    assert.equal(matchesReportOutlet(type, 'Maria Clara Resort', 'Buenaventura Café'),false);
    assert.ok(matchesReportOutlet(type, '—', NO_OUTLET));
    assert.ok(matchesReportOutlet(type, 'Maria Clara Resort', ''));
  }
  assert.ok(matchesReportOutlet('criteria', null, 'Maria Clara Resort'));
});
