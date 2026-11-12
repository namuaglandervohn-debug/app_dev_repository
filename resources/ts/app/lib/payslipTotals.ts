const earningFields = [
  'basicPayAmt', 'otAmt', 'nsdAmt', 'regularHolidayAmt', 'specialHolidayAmt',
  'silAmt', 'allowanceAmt', 'retroAmt',
] as const;
const deductionFields = [
  'sssAmt', 'phicAmt', 'hdmfAmt', 'cashAdvance', 'atd', 'otherCharges',
  'breakages', 'amesco', 'pagibigLoan', 'lateDeductionAmt', 'undertimeDeductionAmt',
] as const;

export const payslipAmountFields = [...earningFields, ...deductionFields] as const;
export type PayslipAmountField = (typeof payslipAmountFields)[number];
type EditableAmounts = Partial<Record<PayslipAmountField, string>>;
type SavedPayslip = EditableAmounts & { grossPay: string; deductions: string };

export const payrollHoursPerDay = 8;
export const regularOvertimeMultiplier = 1.25;

export const payrollPremiumFields = [
  { field: 'nsdHours', column: 'nsd_percent', label: 'Night Shift Differential', basis: 'hourly' },
  { field: 'regularHolidayDays', column: 'regular_holiday_percent', label: 'Regular Holiday', basis: 'daily' },
  { field: 'specialHolidayDays', column: 'special_holiday_percent', label: 'Special Holiday', basis: 'daily' },
  { field: 'silDays', column: 'sil_percent', label: 'Service Incentive Leave (SIL)', basis: 'daily' },
] as const;

type PremiumColumn = (typeof payrollPremiumFields)[number]['column'];
export type PayrollPremiumRates = Partial<Record<PremiumColumn, number | null>>;

export const payslipQuantityAmounts = {
  regularHours: 'basicPayAmt',
  overtime: 'otAmt',
  nsdHours: 'nsdAmt',
  regularHolidayDays: 'regularHolidayAmt',
  specialHolidayDays: 'specialHolidayAmt',
  silDays: 'silAmt',
  tardinessMin: 'lateDeductionAmt',
  undertimeHours: 'undertimeDeductionAmt',
} as const;

export type PayslipQuantityField = keyof typeof payslipQuantityAmounts;
type PayslipRatesSource = EditableAmounts & Partial<Record<PayslipQuantityField, string>> & { hourlyRate?: number };

const roundMoney = (amount: number) => Number(amount.toFixed(2));

function amount(value?: string) {
  const parsed = parseFloat(String(value ?? '').replace(/[₱,]/g, ''));
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

export function calculatePayslipLineAmount(saved: PayslipRatesSource, field: PayslipQuantityField, value: string, premiumRates: PayrollPremiumRates = {}) {
  const quantity = Number(value.trim());
  if (!Number.isFinite(quantity) || quantity < 0) return undefined;

  const savedQuantity = Number(saved[field]);
  const savedAmount = amount(saved[payslipQuantityAmounts[field]]);
  const savedUnitRate = savedQuantity > 0 && savedAmount > 0 ? savedAmount / savedQuantity : undefined;
  const regularHours = Number(saved.regularHours);
  const basicPay = amount(saved.basicPayAmt);
  const hourlyRate = saved.hourlyRate ?? (regularHours > 0 && basicPay > 0 ? basicPay / regularHours : undefined);

  switch (field) {
    case 'regularHours':
      return hourlyRate === undefined ? undefined : roundMoney(quantity * hourlyRate);
    case 'overtime': {
      const overtimeRate = hourlyRate === undefined ? savedUnitRate : hourlyRate * regularOvertimeMultiplier;
      return overtimeRate === undefined ? undefined : roundMoney(quantity * overtimeRate);
    }
    case 'tardinessMin':
      return hourlyRate === undefined ? undefined : roundMoney(Math.round(quantity) / 60 * hourlyRate);
    case 'undertimeHours':
      return hourlyRate === undefined ? undefined : roundMoney(Math.round(quantity * 60) / 60 * hourlyRate);
    default: {
      const premium = payrollPremiumFields.find(item => item.field === field);
      const percent = premium && premiumRates[premium.column];
      if (percent != null && Number.isFinite(percent) && percent >= 0) {
        if (percent === 0) return 0;
        if (hourlyRate !== undefined) {
          const baseRate = premium?.basis === 'daily' ? hourlyRate * payrollHoursPerDay : hourlyRate;
          return roundMoney(quantity * baseRate * (percent / 100));
        }
      }
      return savedUnitRate === undefined ? undefined : roundMoney(quantity * savedUnitRate);
    }
  }
}

export function netPayAfterDeductions(gross: number, deductions: number) {
  return roundMoney(Math.max(gross - deductions, 0));
}

export function calculatePayslipTotals(saved: SavedPayslip, edited: EditableAmounts) {
  // Apply each edit once while retaining amounts outside the editable lines.
  const change = (fields: readonly (keyof EditableAmounts)[]) => fields.reduce(
    (total, field) => total + amount(edited[field]) - amount(saved[field]), 0,
  );
  const gross = roundMoney(amount(saved.grossPay) + change(earningFields));
  const deductions = roundMoney(amount(saved.deductions) + change(deductionFields));
  return { gross, deductions, net: netPayAfterDeductions(gross, deductions) };
}
