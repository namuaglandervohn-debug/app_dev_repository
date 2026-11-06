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
