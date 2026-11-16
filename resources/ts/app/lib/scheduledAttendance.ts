import { parseScheduleDateRange } from './displayDate.ts';
import { pairAttendancePunches } from './payrollPremiums.ts';
import { parseRegularScheduleShift, parseScheduleClock } from './regularScheduleShift.ts';

type Interval = [number, number];
const dayMinutes = 1440;
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

export type AttendanceSchedule = Partial<Record<(typeof weekdays)[number], string | null>> & {
  employee_id: string;
  week: string | null;
  break_time: string | null;
  status: string | null;
};

export type ApprovedTimeRequest = {
  employee_id: string;
  request_type: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
};

export type AttendancePunchRow = {
  employee_id?: string | null;
  attendance_date: string;
  time_in?: string | null;
  time_out?: string | null;
  work_intervals?: unknown;
  source?: string | null;
  remarks?: string | null;
  total_hours?: number | string | null;
  late_minutes?: number | string | null;
  undertime_minutes?: number | string | null;
  overtime_minutes?: number | string | null;
  is_absent?: boolean | null;
  is_incomplete?: boolean | null;
  is_late?: boolean | null;
  is_undertime?: boolean | null;
  is_overtime?: boolean | null;
};

const minutes = (value?: string | null) => parseScheduleClock(value ?? '')?.minutes;

export function getWorkIntervals(punches: string[]): Interval[] | null {
  const values = punches.map(minutes);
  if (!values.length || values.some(value => value === undefined)) return null;
  const pairs = pairAttendancePunches(values as number[]);
  return pairs.length === values.length / 2 && pairs[pairs.length - 1][1] - pairs[0][0] < dayMinutes ? pairs : null;
}

function readIntervals(row: AttendancePunchRow): Interval[] | null {
  const pairs = row.work_intervals;
  if (Array.isArray(pairs) && pairs.length && pairs.every((pair, index) =>
    Array.isArray(pair) && pair.length === 2 && pair.every(Number.isInteger) &&
    pair[0] >= (index ? pairs[index - 1][1] : 0) && pair[1] > pair[0] && pair[1] < 2 * dayMinutes
  )) return pairs;
  if (row.is_incomplete && row.source === 'Biometric Import') return null;
  return getWorkIntervals([row.time_in ?? '', row.time_out ?? '']);
}

const overlap = ([start, end]: Interval, [from, to]: Interval) => Math.max(0, Math.min(end, to) - Math.max(start, from));
const sumMinutes = (intervals: Interval[]) => intervals.reduce((sum, [start, end]) => sum + end - start, 0);

function getBreakMinutes(value?: string | null) {
  const hours = Number(value?.match(/(\d+)\s*hours?/i)?.[1] ?? 0);
  const mins = Number(value?.match(/(\d+)\s*minutes?/i)?.[1] ?? 0);
  return hours * 60 + mins;
}

function requestOverlap(work: Interval[], requests: ApprovedTimeRequest[], type: string) {
  const approved: Interval[] = [];
  for (const request of requests) {
    if (request.request_type !== type) continue;
    const pair = getWorkIntervals([request.start_time ?? '', request.end_time ?? '']);
    if (pair) {
      approved.push(pair[0], [pair[0][0] + dayMinutes, pair[0][1] + dayMinutes]);
    }
  }
  const combined: Interval[] = [];
  for (const [start, end] of approved.sort((a, b) => a[0] - b[0])) {
    const previous = combined[combined.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else combined.push([start, end]);
  }
  return work.reduce((sum, interval) => sum + combined.reduce((total, approvedPeriod) =>
    total + overlap(interval, approvedPeriod), 0), 0);
}

export function createAttendanceCalculator(schedules: AttendanceSchedule[], approvedRequests: ApprovedTimeRequest[]) {
  const scheduleDirectory = new Map<string, { row: AttendanceSchedule; start: string; end: string }[]>();
  for (const row of schedules) {
    const range = parseScheduleDateRange(row.week);
    if (!range || row.status === 'Declined') continue;
    const entries = scheduleDirectory.get(row.employee_id) ?? [];
    entries.push({ row, ...range });
    scheduleDirectory.set(row.employee_id, entries);
  }
  const requestDirectory = new Map<string, ApprovedTimeRequest[]>();
  for (const request of approvedRequests) {
    const entries = requestDirectory.get(request.employee_id) ?? [];
    entries.push(request);
    requestDirectory.set(request.employee_id, entries);
  }

  return function calculate<T extends AttendancePunchRow>(row: T, recalculateUnscheduled = false) {
    const date = row.attendance_date;
    const employeeId = row.employee_id ?? '';
    const weekday = weekdays[new Date(date + 'T00:00:00Z').getUTCDay()];
    const assignments = (scheduleDirectory.get(employeeId) ?? []).filter(schedule => date >= schedule.start && date <= schedule.end);
    const specialDuty = assignments.find(({ row: schedule }) => schedule.week?.includes(' | Special Duty: ') &&
      parseRegularScheduleShift(schedule[weekday] ?? ''));
    const regular = assignments.filter(({ row: schedule }) => !schedule.week?.includes(' | Special Duty: '));
    const schedule = (specialDuty ?? regular.find(assignment => assignment.start === assignment.end) ?? regular[0])?.row;
    const description = schedule?.[weekday]?.trim() || '';
    const shift = parseRegularScheduleShift(description);
    const scheduledBreak = shift?.intervals.length === 1 ? Math.min(shift.intervals[0][1] - shift.intervals[0][0], getBreakMinutes(schedule?.break_time)) : 0;
    const requests = (requestDirectory.get(employeeId) ?? []).filter(request =>
      date >= request.start_date && date <= (request.end_date ?? request.start_date));
    const punches = readIntervals(row);
    const clocked = punches && !row.is_absent;
    const start = shift?.intervals[0][0];
    const end = shift?.intervals[shift.intervals.length - 1][1];
    const knownDay = Boolean(shift || /^(?:off|rd|rest day|flex|suspended)$/i.test(description));
    const legacy = !knownDay && !recalculateUnscheduled && row.source !== 'Manual Encoding';
    let totalHours = Number(row.total_hours) || 0;
    let late = Number(row.late_minutes) || 0;
    let undertime = Number(row.undertime_minutes) || 0;
    let overtime = legacy ? Number(row.overtime_minutes) || 0 : 0;
    let paidOvertime = 0;
    let approvedUndertime = 0;
    let workedIntervals: Interval[] | null = punches;
    let overtimeStart: number | undefined;

    if (clocked && start !== undefined && end !== undefined && shift) {
      const offset = end >= dayMinutes && punches[0][0] < end - dayMinutes ? dayMinutes : 0;
      const actual = punches.map(([from, to]): Interval => [from + offset, to + offset]);
      const actualStart = actual[0][0];
      const actualEnd = actual[actual.length - 1][1];
      const breaks = shift.intervals.slice(1).map(([from], index): Interval => [shift.intervals[index][1], from]);
      workedIntervals = punches.flatMap(([from, to]) => {
        let segments: Interval[] = [[from, to]];
        for (const [breakStart, breakEnd] of breaks) {
          segments = segments.flatMap((segment): Interval[] => {
            if (!overlap(segment, [breakStart - offset, breakEnd - offset])) return [segment];
            const [a, b] = segment;
            return [[a, breakStart - offset], [breakEnd - offset, b]].filter(([x, y]) => y > x) as Interval[];
          });
        }
        return segments;
      });
      const span = overlap([actualStart, actualEnd], [start, end]);
      const workedInShift = actual.reduce((sum, interval) => sum + overlap(interval, [start, end]), 0);
      // A duration-only break has no assigned clock time. Credit any break already recorded.
      const unrecordedBreak = Math.min(workedInShift, Math.max(0, scheduledBreak - (span - workedInShift)));
      totalHours = Number(((sumMinutes(workedIntervals) - unrecordedBreak) / 60).toFixed(2));
      late = 0;
      const shortfall: Interval[] = [];
      for (const [from, to] of shift.intervals) {
        const present = actual.filter(interval => overlap(interval, [from, to]) > 0);
        if (present.length) {
          late += Math.max(0, present[0][0] - from);
          const lastOut = present[present.length - 1][1];
          if (lastOut < to) shortfall.push([lastOut, to]);
        } else if (actualStart >= to) {
          late += to - from;
        } else {
          shortfall.push([from, to]);
        }
      }
      undertime = sumMinutes(shortfall);
      const extra = actual.map(([from, to]): Interval => [Math.max(from, end), to]).filter(([from, to]) => to > from);
      overtime = sumMinutes(extra);
      overtimeStart = extra[0]?.[0];
      paidOvertime = requestOverlap(extra, requests, 'Overtime');
      approvedUndertime = requestOverlap(shortfall, requests, 'Undertime');
    } else if (clocked) {
      if (!legacy) {
        totalHours = Number((sumMinutes(punches) / 60).toFixed(2));
        late = 0;
        undertime = 0;
      }
      if (legacy) {
        const actualEnd = punches[punches.length - 1][1];
        const extra = punches.map(([from, to]): Interval => [Math.max(from, actualEnd - overtime), to]).filter(([from, to]) => to > from);
        paidOvertime = requestOverlap(extra, requests, 'Overtime');
        approvedUndertime = Math.min(undertime, requestOverlap([[actualEnd, actualEnd + undertime]], requests, 'Undertime'));
      } else if (/^(?:off|rd|rest day)$/i.test(description)) {
        paidOvertime = requestOverlap(punches, requests, 'Overtime');
        overtime = paidOvertime;
      }
    }

    return {
      ...row,
      total_hours: totalHours,
      late_minutes: late,
      undertime_minutes: undertime,
      overtime_minutes: overtime,
      is_late: late > 0,
      is_undertime: undertime > 0,
      is_overtime: overtime > 0,
      is_incomplete: row.is_absent || /^on leave\b/i.test(row.remarks ?? '') ? false
        : !punches || (!row.work_intervals && Boolean(row.is_incomplete)),
      workedIntervals,
      scheduledMinutes: shift ? sumMinutes(shift.intervals) - scheduledBreak : knownDay ? 0 : undefined,
      scheduleLabel: description,
      paidOvertime,
      approvedUndertime,
      overtimeStart,
    };
  };
}

export type CalculatedAttendance = ReturnType<ReturnType<typeof createAttendanceCalculator>>;

export function summarizePayrollHours(logs: Pick<CalculatedAttendance,
  'total_hours' | 'late_minutes' | 'undertime_minutes' | 'overtime_minutes' | 'paidOvertime' | 'is_absent'>[]) {
  return logs.reduce((totals, log) => {
    if (log.is_absent) return totals;
    return {
      workedHours: totals.workedHours + log.total_hours,
      regularMinutes: totals.regularMinutes + Math.max(0, Math.round(log.total_hours * 60) - log.overtime_minutes),
      overtimeMinutes: totals.overtimeMinutes + log.paidOvertime,
      lateMinutes: totals.lateMinutes + log.late_minutes,
      undertimeMinutes: totals.undertimeMinutes + log.undertime_minutes,
    };
  }, { workedHours: 0, regularMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, undertimeMinutes: 0 });
}
