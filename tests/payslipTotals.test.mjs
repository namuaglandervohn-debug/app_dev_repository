import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayslipLineAmount, calculatePayslipTotals, netPayAfterDeductions } from '../resources/ts/app/lib/payslipTotals.ts';

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

test('changing payroll hours and minutes uses the saved hourly rate', () => {
  const saved = { hourlyRate: 62.5 };
  assert.equal(calculatePayslipLineAmount(saved, 'regularHours', '109.85'), 6865.63);
  assert.equal(calculatePayslipLineAmount(saved, 'overtime', '2'), 156.25);
  assert.equal(calculatePayslipLineAmount(saved, 'tardinessMin', '15'), 15.63);
  assert.equal(calculatePayslipLineAmount(saved, 'undertimeHours', '0.5'), 31.25);
  assert.equal(calculatePayslipLineAmount(saved, 'regularHours', ''), 0);
  assert.equal(calculatePayslipLineAmount(saved, 'regularHours', '-2'), undefined);
  assert.equal(calculatePayslipLineAmount(saved, 'regularHours', '1..5'), undefined);
});

test('older payslips reuse their recorded unit rates where available', () => {
  const saved = { regularHours: '8', basicPayAmt: '₱500', regularHolidayDays: '1', regularHolidayAmt: '₱1,000' };
  assert.equal(calculatePayslipLineAmount(saved, 'regularHours', '16'), 1000);
  assert.equal(calculatePayslipLineAmount(saved, 'regularHolidayDays', '2'), 2000);
  assert.equal(calculatePayslipLineAmount(saved, 'specialHolidayDays', '1'), undefined);
});

test('attendance deductions replace their saved amounts once and leave other deductions in place', () => {
  const saved = { grossPay: '₱1,000', deductions: '₱40', lateDeductionAmt: '₱10', undertimeDeductionAmt: '₱5' };
  assert.deepEqual(calculatePayslipTotals(saved, { lateDeductionAmt: '₱20', undertimeDeductionAmt: '₱0' }), {
    gross: 1000, deductions: 45, net: 955,
  });
});
