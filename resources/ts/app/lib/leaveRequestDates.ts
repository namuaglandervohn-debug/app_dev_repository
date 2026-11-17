/** Leave requests follow the company's Philippine calendar date. */
export function currentLeaveDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function leaveDateError(startDate: string, endDate: string, today = currentLeaveDate()): string | null {
  if ((startDate && startDate < today) || (endDate && endDate < today)) {
    return 'Leave dates cannot be in the past. Select today or a future date.';
  }
  if (startDate && endDate && endDate < startDate) {
    return 'End date cannot be earlier than start date.';
  }
  return null;
}

export function leaveDaysInYear(startDate: string, endDate: string, year: number) {
  if (!startDate || !endDate) return 0;
  const start = Date.parse(`${startDate < `${year}-01-01` ? `${year}-01-01` : startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate > `${year}-12-31` ? `${year}-12-31` : endDate}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 86_400_000 + 1) : 0;
}
export function currentManilaMinutes(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  return Number(parts.find(part => part.type === 'hour')?.value) * 60
    + Number(parts.find(part => part.type === 'minute')?.value);
}
