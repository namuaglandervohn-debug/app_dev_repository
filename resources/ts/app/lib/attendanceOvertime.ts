export const REQUIRED_DAILY_HOURS = 8;

export function getAttendanceOvertimeMinutes({
  overtime_minutes,
  total_hours,
}: {
  overtime_minutes?: number | string | null;
  total_hours?: number | string | null;
}) {
  const recordedMinutes = Number(overtime_minutes);
  if (Number.isFinite(recordedMinutes) && recordedMinutes > 0) return Math.round(recordedMinutes);

  const workedHours = Number(total_hours);
  return Number.isFinite(workedHours)
    ? Math.max(0, Math.round((workedHours - REQUIRED_DAILY_HOURS) * 60))
    : 0;
}
