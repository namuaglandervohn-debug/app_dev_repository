import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayslipTotals, netPayAfterDeductions } from '../resources/ts/app/lib/payslipTotals.ts';

test('payslip edits apply only the change to each line and retain unitemized amounts', () => {
  const saved = { grossPay: '₱6,000.00', deductions: '₱300.00', basicPayAmt: '₱5,000', sssAmt: '100' };
  assert.deepEqual(calculatePayslipTotals(saved, saved), { gross: 6000, deductions: 300, net: 5700 });
  assert.deepEqual(calculatePayslipTotals(saved, { ...saved, allowanceAmt: '250.50', sssAmt: '175.25' }), {
    gross: 6250.50, deductions: 375.25, net: 5875.25,
  });
  assert.deepEqual(calculatePayslipTotals(saved, { ...saved, sssAmt: '' }), { gross: 6000, deductions: 200, net: 5800 });
});

test('net pay rounds to cents and retains the existing zero floor', () => {
  assert.equal(netPayAfterDeductions(10.30, 0.10), 10.20);
  assert.equal(netPayAfterDeductions(100, 150), 0);
});
