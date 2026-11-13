import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayrollPremiums, pairAttendancePunches } from '../resources/ts/app/lib/payrollPremiums.ts';

const day = (attendance_date, hours = 8) => ({ attendance_date, time_in: '08:00:00', time_out: '16:00:00', total_hours: hours });

test('night differential excludes unpaid breaks and includes hours after midnight up to 6 AM', () => {
  const log = {
    attendance_date: '2026-07-05', time_in: '21:00:00', time_out: '07:00:00', total_hours: 9,
    work_intervals: pairAttendancePunches([1260, 120, 180, 420]),
  };
  const premiums = calculatePayrollPremiums([log], [], 525, {});
  assert.equal(premiums.nsdHours, 7);
  assert.equal(premiums.nsdAmt, 45.94);
  assert.equal(premiums.nightNeedsReview, false);
  assert.equal(calculatePayrollPremiums([{ ...log, work_intervals: null }], [], 525, {}).nightNeedsReview, true);
});

test('worked holidays add only the premium, unworked regular holidays pay one day', () => {
  const holidays = [
    { date: '2026-07-01', type: 'regular' },
    { date: '2026-07-02', type: 'regular' },
    { date: '2026-07-03', type: 'special' },
    { date: '2026-07-04', type: 'special' },
  ];
  const premiums = calculatePayrollPremiums([day('2026-07-01'), day('2026-07-03')], holidays, 525, {});
  assert.equal(premiums.regularHolidayDays, 2);
  assert.equal(premiums.regularHolidayAmt, 1050);
  assert.equal(premiums.specialHolidayDays, 1);
  assert.equal(premiums.specialHolidayAmt, 157.5);
  assert.equal(calculatePayrollPremiums([], holidays, 525, {}, '2026-07-03').regularHolidayAmt, 0);
});

test('saved rate overrides include explicit zero and do not affect unworked regular holiday pay', () => {
  const holidays = [
    { date: '2026-07-06', type: 'regular' },
    { date: '2026-07-07', type: 'special' },
    { date: '2026-07-20', type: 'regular' },
  ];
  const night = { ...day('2026-07-07'), time_in: '22:00:00', time_out: '06:00:00' };
  const premiums = calculatePayrollPremiums([day('2026-07-06'), night], holidays, 525, {
    nsd_percent: 20, regular_holiday_percent: 50, special_holiday_percent: 0,
  });
  assert.equal(premiums.nsdAmt, 105);
  assert.equal(premiums.regularHolidayAmt, 787.5);
  assert.equal(premiums.specialHolidayAmt, 0);
});
