import test from 'node:test';
import assert from 'node:assert/strict';
import { currentLeaveDate, leaveDateError } from '../resources/ts/app/lib/leaveRequestDates.ts';

test('leave date changes at Philippine midnight, including year boundaries', () => {
  assert.equal(currentLeaveDate(new Date('2026-11-03T15:59:59Z')), '2026-11-03');
  assert.equal(currentLeaveDate(new Date('2026-11-03T16:00:00Z')), '2026-11-04');
  assert.equal(currentLeaveDate(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
});

test('past leave dates are rejected while today and future dates are allowed', () => {
  const today = '2026-11-04';
  assert.match(leaveDateError('2026-11-03', '2026-11-04', today), /past/);
  assert.match(leaveDateError('2026-11-04', '2026-11-03', today), /past/);
  assert.equal(leaveDateError(today, today, today), null);
  assert.equal(leaveDateError('2026-11-05', '2026-11-06', today), null);
  assert.match(leaveDateError('2026-11-06', '2026-11-05', today), /earlier than start/);
});
