import { NO_OUTLET } from './constants.ts';

const outletReports = new Set(['employees', 'schedules', 'attendance', 'attendanceLogs', 'payroll', 'evaluations', 'requests']);

function outletKey(value?: string | null) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchesReportOutlet(type: string, value: string | null | undefined, selected: string) {
  if (!selected || !outletReports.has(type)) return true;
  const key = outletKey(value);
  return selected === NO_OUTLET
    ? ['', '—', 'no outlet', NO_OUTLET].includes(key)
    : key === outletKey(selected);
}
