import test from 'node:test';
import assert from 'node:assert/strict';
import { getAttendanceOvertimeMinutes } from '../resources/ts/app/lib/attendanceOvertime.ts';

test('derives overtime from worked hours when the saved minutes are zero or missing', () => {
  assert.equal(getAttendanceOvertimeMinutes({ total_hours: '9.02', overtime_minutes: 0 }), 61);
  assert.equal(getAttendanceOvertimeMinutes({ total_hours: 8.93 }), 56);
});

test('uses explicitly recorded overtime without adding derived minutes', () => {
  assert.equal(getAttendanceOvertimeMinutes({ total_hours: 9.3, overtime_minutes: 30 }), 30);
});

test('returns no overtime for shorter shifts or missing work hours', () => {
  assert.equal(getAttendanceOvertimeMinutes({ total_hours: 7.1, overtime_minutes: 0 }), 0);
  assert.equal(getAttendanceOvertimeMinutes({ total_hours: 8, overtime_minutes: null }), 0);
  assert.equal(getAttendanceOvertimeMinutes({}), 0);
});
