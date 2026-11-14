import { NO_OUTLET } from './constants.ts';

export const employeeSearchFields = {
  all: 'All fields', id: 'Employee ID', name: 'Name', position: 'Position',
  outlet: 'Outlet / Branch', status: 'Employment status', contact: 'Contact',
};
export type EmployeeSearchField = keyof typeof employeeSearchFields;
export type EmployeeColumnFilters = Record<Exclude<EmployeeSearchField, 'all'>, string>;
export const emptyEmployeeFilters: EmployeeColumnFilters = { id: '', name: '', position: '', outlet: '', status: '', contact: '' };

export function filterEmployeeRecords<T extends Record<keyof EmployeeColumnFilters, string> & { email?: string }>(records: T[], search: string, field: EmployeeSearchField, filters: EmployeeColumnFilters): T[] {
  const keyword = search.trim().toLowerCase();
  const keys = Object.keys(filters) as (keyof EmployeeColumnFilters)[];
  return records.filter(record => {
    const text = (key: keyof EmployeeColumnFilters) => (key === 'contact' ? `${record.contact ?? ''} ${record.email ?? ''}` : String(record[key] ?? '')).toLowerCase();
    const matchesSearch = !keyword || (field === 'all' ? keys : [field]).some(key => text(key).includes(keyword));
    return matchesSearch && keys.every(key => !filters[key] || (key === 'outlet' && filters[key] === NO_OUTLET
      ? !text(key).trim()
      : ['position', 'outlet', 'status'].includes(key)
      ? record[key] === filters[key]
      : text(key).includes(filters[key].trim().toLowerCase())));
  });
}
