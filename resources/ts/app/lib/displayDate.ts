const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila',
});

export function parseDisplayDate(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return '';
  const [, month, day, year] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(iso + 'T00:00:00Z');
  return year !== '0000' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : '';
}

export function formatTypedDateDigits(digits: string) {
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
}

export function formatDisplayDate(value?: string | Date | null, fallback = ''): string {
  if (!value) return fallback;
  if (typeof value === 'string') {
    const exact = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (exact) return `${exact[2]}/${exact[3]}/${exact[1]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : fallback;
}

export function formatDisplayDateTime(value?: string | Date | null, fallback = '') {
  if (!value) return fallback;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDisplayDate(value, fallback);
  const timestamp = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)
    ? value + '+08:00' : value;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return Number.isFinite(date.getTime()) ? `${dateFormatter.format(date)} ${timeFormatter.format(date)}` : fallback;
}

export function parseScheduleDateRange(value?: string | null): { start: string; end: string } | null {
  const label = value?.split(' | Special Duty: ')[0].trim() ?? '';
  const singleDate = parseDisplayDate(label) || (/^\d{4}-\d{2}-\d{2}$/.test(label) ? parseDisplayDate(formatDisplayDate(label)) : '');
  if (singleDate) return { start: singleDate, end: singleDate };
  const numeric = /^(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{1,2}\/\d{4})$/.exec(label);
  if (numeric) {
    const start = parseDisplayDate(numeric[1]);
    const end = parseDisplayDate(numeric[2]);
    return start && end && start <= end ? { start, end } : null;
  }
  const compact = /^([A-Za-z]+)\s+(\d{1,2})\s*[-–—]\s*(?:([A-Za-z]+)\s+)?(\d{1,2}),\s*(\d{4})$/.exec(label);
  if (!compact) return null;
  const [, firstMonth, firstDay, lastMonth = firstMonth, lastDay, year] = compact;
  const first = monthNumbers.get(firstMonth.toLowerCase());
  const last = monthNumbers.get(lastMonth.toLowerCase());
  if (!first || !last) return null;
  const firstYear = Number(year) - (first > last ? 1 : 0);
  const start = parseDisplayDate(`${first}/${firstDay}/${firstYear}`);
  const end = parseDisplayDate(`${last}/${lastDay}/${year}`);
  return start && end && start <= end ? { start, end } : null;
}

export function formatDisplayDateRange(value?: string | null) {
  if (!value) return '';
  const range = parseScheduleDateRange(value);
  if (range) return range.start === range.end
    ? formatDisplayDate(range.start)
    : `${formatDisplayDate(range.start)} – ${formatDisplayDate(range.end)}`;
  return value.replace(/\b\d{4}-\d{2}-\d{2}\b/g, date => formatDisplayDate(date));
}

const monthNumbers = new Map(
  'January February March April May June July August September October November December'.split(' ')
    .flatMap((month, index) => [[month.toLowerCase(), index + 1], [month.slice(0, 3).toLowerCase(), index + 1]] as const),
);
