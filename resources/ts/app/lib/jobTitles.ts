import { POSITIONS } from './constants';

export const jobTitleKey = (title: string) => title.trim().toLowerCase();

const standardJobTitles = POSITIONS.filter(title => title !== 'Payroll Staff');

export function getJobTitleOptions(savedTitles: ReadonlyArray<string | null | undefined>) {
  const titles = new Map(standardJobTitles.map(title => [jobTitleKey(title), title]));
  const customTitles = savedTitles
    .map(title => title?.trim() ?? '')
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  for (const title of customTitles) {
    const key = jobTitleKey(title);
    if (!titles.has(key)) titles.set(key, title);
  }
  return [...titles.values()];
}
