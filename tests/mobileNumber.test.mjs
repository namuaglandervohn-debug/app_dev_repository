import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMobileNumber, isPhilippineMobileNumber, localMobileNumber } from '../resources/ts/app/lib/mobileNumber.ts';

test('existing local numbers and pasted country-coded numbers show the same digits', () => {
  for (const value of ['09123456789', '+63 912 345 6789', '639123456789', '9123456789']) {
    assert.equal(localMobileNumber(value), '9123456789');
    assert.equal(isPhilippineMobileNumber(value), true);
  }
  assert.equal(formatMobileNumber('9123456789'), '+639123456789');
  assert.equal(formatMobileNumber(''), '');
});

test('short numbers and numbers with the wrong mobile prefix fail validation', () => {
  assert.equal(isPhilippineMobileNumber('+639123'), false);
  assert.equal(isPhilippineMobileNumber('+638123456789'), false);
});
