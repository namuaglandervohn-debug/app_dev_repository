const earningFields = [
  'basicPayAmt', 'otAmt', 'nsdAmt', 'regularHolidayAmt', 'specialHolidayAmt',
  'silAmt', 'allowanceAmt', 'retroAmt',
] as const;
const deductionFields = [
  'sssAmt', 'phicAmt', 'hdmfAmt', 'cashAdvance', 'atd', 'otherCharges',
  'breakages', 'amesco', 'pagibigLoan',
] as const;

type EditableAmounts = Partial<Record<(typeof earningFields)[number] | (typeof deductionFields)[number], string>>;
type SavedPayslip = EditableAmounts & { grossPay: string; deductions: string };

const roundMoney = (amount: number) => Number(amount.toFixed(2));

function amount(value?: string) {
  const parsed = parseFloat(String(value ?? '').replace(/[₱,]/g, ''));
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
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
