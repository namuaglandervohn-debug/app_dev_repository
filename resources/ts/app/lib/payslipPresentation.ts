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
  const first = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(first.getTime()) || !Number.isFinite(last.getTime())) return fallback;
  const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  const startLabel = first.getUTCFullYear() === last.getUTCFullYear() ? monthDay.format(first) : date.format(first);
  return `${startLabel} - ${date.format(last)}`;
}

export function escapePayslipText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
