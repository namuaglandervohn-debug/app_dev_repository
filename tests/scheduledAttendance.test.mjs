import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttendanceCalculator, getWorkIntervals, summarizePayrollHours } from '../resources/ts/app/lib/scheduledAttendance.ts';
import { calculateAttendancePay, netPayAfterDeductions } from '../resources/ts/app/lib/payslipTotals.ts';
import { leaveDaysInYear } from '../resources/ts/app/lib/leaveRequestDates.ts';

const shift = {
  employee_id: 'employee-a', week: '08/08/2026', status: 'Confirmed', break_time: '1 hour',
  saturday: '08:00 AM - 12:00 PM / 01:00 PM - 04:00 PM',
};
const row = (employee_id, punches, attendance_date = '2026-08-08') => ({
  employee_id, attendance_date, work_intervals: getWorkIntervals(punches), source: 'Manual Encoding',
});
const approval = (request_type, start_time, end_time, employee_id = 'employee-a') => ({
  employee_id, request_type, start_date: '2026-08-08', end_date: '2026-08-08', start_time, end_time,
});

test('a single-date split shift tracks late minutes and six hours of overtime independently', () => {
  const calculate = createAttendanceCalculator([shift], []);
  const entry = row('employee-a', ['08:30', '22:00']);
  const result = calculate(entry);
  assert.equal(result.total_hours, 12.5);
  assert.equal(result.scheduledMinutes, 420);
  assert.equal(result.late_minutes, 30);
  assert.equal(result.undertime_minutes, 0);
  assert.equal(result.overtime_minutes, 360);
  assert.equal(result.paidOvertime, 0);
  assert.equal(result.overtimeStart, 16 * 60);
  assert.deepEqual(entry.work_intervals, [[510, 1320]]);
  assert.deepEqual(result.workedIntervals, [[510, 720], [780, 1320]]);
});

test('manual attendance changes with each employee, selected date, and schedule edit', () => {
  const differentShift = {
    ...shift, employee_id: 'employee-b', week: 'August 3–9, 2026',
    saturday: '08:00 AM - 02:00 PM / 04:00 PM - 08:00 PM',
  };
  const punches = ['09:00', '14:00', '16:00', '18:30'];
  const calculate = createAttendanceCalculator([shift, differentShift], [
    approval('Undertime', '18:30', '20:00', 'employee-b'),
  ]);
  const result = calculate(row('employee-b', punches));
  assert.equal(result.total_hours, 7.5);
  assert.equal(result.late_minutes, 60);
  assert.equal(result.undertime_minutes, 90);
  assert.equal(result.approvedUndertime, 90);
  assert.equal(result.overtime_minutes, 0);
  assert.equal(calculate(row('employee-a', punches)).approvedUndertime, 0);
  assert.equal(calculate(row('employee-b', punches, '2026-08-15')).late_minutes, 0);
  const modified = createAttendanceCalculator([{ ...differentShift, status: 'Draft', saturday: '09:00 AM - 02:00 PM / 04:00 PM - 08:00 PM' }], []);
  assert.equal(modified(result).late_minutes, 0);
  assert.equal(modified(result).undertime_minutes, 90);
});

test('only the overlap with approved overtime is payable and overlapping approvals count once', () => {
  const calculate = createAttendanceCalculator([shift], [
    approval('Overtime', '16:30:00', '18:00:00'),
    approval('Overtime', '17:00:00', '19:30:00'),
    { ...approval('Overtime', '19:30', '22:00'), start_date: '2026-08-09', end_date: '2026-08-09' },
  ]);
  const result = calculate(row('employee-a', ['08:30', '12:00', '13:00', '22:00']));
  assert.equal(result.overtime_minutes, 360);
  assert.equal(result.paidOvertime, 180);
  assert.deepEqual(summarizePayrollHours([result]), {
    workedHours: 12.5, regularMinutes: 390, overtimeMinutes: 180, lateMinutes: 30, undertimeMinutes: 0,
  });
});

test('split shifts count late arrivals and early departures for each session', () => {
  const calculate = createAttendanceCalculator([shift], [approval('Undertime', '11:30', '12:00')]);
  const result = calculate(row('employee-a', ['08:30', '11:30', '13:20', '22:00']));
  assert.equal(result.late_minutes, 50);
  assert.equal(result.undertime_minutes, 30);
  assert.equal(result.approvedUndertime, 30);
  assert.equal(result.overtime_minutes, 360);
});

test('overnight shifts match the correct end time and use a recorded break once', () => {
  const overnight = { ...shift, saturday: '22:00 - 06:00' };
  const calculate = createAttendanceCalculator([overnight], [approval('Overtime', '06:30', '07:30')]);
  const result = calculate(row('employee-a', ['22:25', '02:00', '03:00', '07:00']));
  assert.equal(result.total_hours, 7.58);
  assert.equal(result.late_minutes, 25);
  assert.equal(result.overtime_minutes, 60);
  assert.equal(result.paidOvertime, 30);
  assert.equal(calculate(row('employee-a', ['22:25', '07:00'])).total_hours, result.total_hours);
  assert.equal(getWorkIntervals(['08:00', '12:00', '11:00', '13:00']), null);
});

test('tardiness and undertime are visible deductions and are applied once to pay', () => {
  const result = calculateAttendancePay({ regularMinutes: 450, overtimeMinutes: 0, lateMinutes: 60, undertimeMinutes: 90 }, 480, 1);
  assert.equal(result.basicPayHours, 18);
  assert.deepEqual(result, { basicPay: 1080, basicPayHours: 18, overtimePay: 0, lateDeduction: 60, undertimeDeduction: 90, absenceDeduction: 480 });
  assert.equal(netPayAfterDeductions(result.basicPay, result.lateDeduction + result.undertimeDeduction + result.absenceDeduction), 450);
});

test('leave uses each calendar year for a request spanning New Year', () => {
  assert.equal(leaveDaysInYear('2026-12-30', '2027-01-03', 2026), 2);
  assert.equal(leaveDaysInYear('2026-12-30', '2027-01-03', 2027), 3);
  assert.equal(leaveDaysInYear('2026-12-30', '2027-01-03', 2025), 0);
});
