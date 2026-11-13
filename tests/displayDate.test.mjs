import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDisplayDate, formatDisplayDateRange, formatDisplayDateTime, parseDisplayDate } from '../resources/ts/app/lib/displayDate.ts';

test('date inputs round-trip ISO dates and reject impossible calendar dates', () => {
  assert.equal(formatDisplayDate('2028-02-29'), '02/29/2028');
  assert.equal(parseDisplayDate('02/29/2028'), '2028-02-29');
  assert.equal(parseDisplayDate('02/29/2026'), '');
  assert.equal(parseDisplayDate('13/01/2026'), '');
});

test('timestamps display their calendar date in Manila', () => {
  assert.equal(formatDisplayDateTime('2026-11-12T16:05:00Z'), '11/13/2026 12:05 AM');
  assert.equal(formatDisplayDateTime('2026-11-13T09:30'), '11/13/2026 9:30 AM');
});

test('formats schedule and report ranges with two complete dates', () => {
  assert.equal(formatDisplayDateRange('December 28 – January 3, 2027'), '12/28/2026 – 01/03/2027');
  assert.equal(formatDisplayDateRange('November 9–15, 2026'), '11/09/2026 – 11/15/2026');
  assert.equal(formatDisplayDateRange('2026-11-09 to 2026-11-15'), '11/09/2026 to 11/15/2026');
  assert.equal(formatDisplayDateRange('November 2026'), 'November 2026');
});
