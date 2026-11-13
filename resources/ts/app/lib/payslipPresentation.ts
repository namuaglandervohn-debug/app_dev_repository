import { formatDisplayDate } from './displayDate';
import { COMPANY } from './constants';

export function payslipHeading(outlet?: string) {
  const branch = outlet?.trim();
  const isMariaClara = /^maria clara (restaurant|resort)(?:\s|$)/i.test(branch ?? '');
  return {
    title: isMariaClara ? 'MARIA CLARA RESTAURANT AND RESORT' : (branch || COMPANY.name).toUpperCase(),
    department: isMariaClara ? 'San Pedro, Wharf Rd. Panabo City, DDN' : branch || '—',
  };
}

export function payslipPeriod(start?: string, end?: string, fallback = '—') {
  if (!start || !end) return fallback;
  const first = formatDisplayDate(start.slice(0, 10));
  const last = formatDisplayDate(end.slice(0, 10));
  return first && last ? first + ' - ' + last : fallback;
}

export function escapePayslipText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
