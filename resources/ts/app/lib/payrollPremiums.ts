export const payrollPremiumDefaults = {
  nsd_percent: 10,
  regular_holiday_percent: 100,
  special_holiday_percent: 30,
};

export type PayrollHoliday = { date: string; type: 'regular' | 'special' };
type WorkInterval = [number, number];
type Attendance = {
  attendance_date: string;
  time_in?: string | null;
  time_out?: string | null;
  work_intervals?: unknown;
  total_hours?: number | string | null;
  is_absent?: boolean | null;
};

const dayMinutes = 1440;
const workHoursPerDay = 8;
const dailyWorkMinutes = workHoursPerDay * 60;
const round = (amount: number) => Number(amount.toFixed(2));

export function pairAttendancePunches(minutes: number[]): WorkInterval[] {
  const intervals: WorkInterval[] = [];
  let previous = -1;
  let offset = 0;
  const timeline = minutes.map(minute => {
    if (minute < previous) offset += dayMinutes;
    previous = minute;
    return minute + offset;
  });
  for (let i = 0; i + 1 < timeline.length; i += 2) {
    if (timeline[i + 1] > timeline[i]) intervals.push([timeline[i], timeline[i + 1]]);
  }
  return intervals;
}

function clockMinutes(value?: string | null) {
  const match = value?.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!match || +match[1] > 23 || +match[2] > 59) return null;
  return +match[1] * 60 + +match[2];
}

function nightMinutes(start: number, end: number) {
  const overlap = (from: number, to: number) => Math.max(0, Math.min(end, to) - Math.max(start, from));
  return overlap(0, 360) + overlap(1320, 1800) + overlap(2760, 2880);
}

function nightWork(log: Attendance, worked: number) {
  const start = clockMinutes(log.time_in);
  const end = clockMinutes(log.time_out);
  if (!worked) return { minutes: 0, needsReview: false };
  if (start === null || end === null || start === end) return { minutes: 0, needsReview: true };

  const shiftEnd = end < start ? end + dayMinutes : end;
  let lastEnd = start;
  const intervals = log.work_intervals;
  if (Array.isArray(intervals) && intervals.length && intervals.every(interval => {
    if (!Array.isArray(interval) || interval.length !== 2) return false;
    const [from, to] = interval;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < lastEnd || to <= from || to > shiftEnd) return false;
    lastEnd = to;
    return true;
  })) {
    const intervalMinutes = intervals.reduce((sum, [from, to]) => sum + to - from, 0);
    if (intervalMinutes === worked) {
      return { minutes: intervals.reduce((sum, [from, to]) => sum + nightMinutes(from, to), 0), needsReview: false };
    }
  }

  const possible = nightMinutes(start, shiftEnd);
  const minutes = Math.max(0, Math.min(worked, shiftEnd - start) - (shiftEnd - start - possible));
  return { minutes, needsReview: minutes !== Math.min(worked, possible) || worked > shiftEnd - start };
}

export function calculatePayrollPremiums(
  logs: Attendance[],
  holidays: PayrollHoliday[],
  dailyRate: number,
  rates: Partial<Record<keyof typeof payrollPremiumDefaults, number | null>>,
  hireDate?: string | null,
) {
  const hourlyRate = dailyRate / workHoursPerDay;
  let nsdMinutes = 0;
  let nightNeedsReview = false;
  const workByDate = new Map<string, number>();
  for (const log of logs) {
    const worked = log.is_absent ? 0 : Math.max(0, Math.round((Number(log.total_hours) || 0) * 60));
    workByDate.set(log.attendance_date, (workByDate.get(log.attendance_date) ?? 0) + worked);
    const night = nightWork(log, worked);
    nsdMinutes += night.minutes;
    nightNeedsReview ||= night.needsReview;
  }

  let regularWorkedDays = 0;
  let regularUnworkedDays = 0;
  let specialDays = 0;
  for (const holiday of holidays) {
    if (hireDate && holiday.date < hireDate) continue;
    const worked = Math.min(workByDate.get(holiday.date) ?? 0, dailyWorkMinutes);
    if (holiday.type === 'regular') {
      if (worked) regularWorkedDays += worked / dailyWorkMinutes;
      else regularUnworkedDays++;
    } else {
      specialDays += worked / dailyWorkMinutes;
    }
  }

  const percent = (key: keyof typeof payrollPremiumDefaults) => (rates[key] ?? payrollPremiumDefaults[key]) / 100;
  return {
    nsdHours: round(nsdMinutes / 60),
    nsdAmt: round(nsdMinutes / 60 * hourlyRate * percent('nsd_percent')),
    nightNeedsReview,
    regularUnworkedDays,
    regularHolidayDays: round(regularWorkedDays + regularUnworkedDays),
    regularHolidayAmt: round(dailyRate * (regularUnworkedDays + regularWorkedDays * percent('regular_holiday_percent'))),
    specialHolidayDays: round(specialDays),
    specialHolidayAmt: round(dailyRate * specialDays * percent('special_holiday_percent')),
  };
}
