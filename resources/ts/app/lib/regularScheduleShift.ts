export const splitShiftExample = '08:00 AM - 12:00 PM / 01:00 PM - 05:00 PM';

function parseTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const period = match[3]?.toUpperCase();
  if (period ? hour < 1 || hour > 12 : hour > 23) return null;

  const hour24 = period ? hour % 12 + (period === 'PM' ? 12 : 0) : hour;
  const minutes = Number(match[2]);
  const displayHour = String(hour24 % 12 || 12).padStart(2, '0');
  return {
    minutes: hour24 * 60 + minutes,
    clock: `${String(hour24).padStart(2, '0')}:${match[2]}`,
    label: `${displayHour}:${match[2]} ${hour24 < 12 ? 'AM' : 'PM'}`,
  };
}

function parsePeriod(value: string) {
  const [start, end, ...extra] = value.split(/[-–—]/);
  if (!end || extra.length) return null;

  const timeIn = parseTime(start);
  const timeOut = parseTime(end);
  if (!timeIn || !timeOut || timeIn.minutes === timeOut.minutes) return null;

  return {
    timeIn,
    timeOut,
    duration: (timeOut.minutes - timeIn.minutes + 1440) % 1440,
    label: `${timeIn.label} - ${timeOut.label}`,
  };
}

export function parseRegularScheduleShift(value: string) {
  const [first, second, ...extra] = value.split('/');
  if (extra.length) return null;

  const morning = parsePeriod(first);
  if (!morning) return null;

  if (second === undefined) {
    return { label: morning.label, timeIn: morning.timeIn.clock, timeOut: morning.timeOut.clock };
  }

  const afternoon = parsePeriod(second);
  if (!afternoon) return null;

  const crossesMidnight = morning.timeOut.minutes < morning.timeIn.minutes;
  const sameDayStart = afternoon.timeIn.minutes - morning.timeIn.minutes;
  const afternoonStart = crossesMidnight && sameDayStart < 0 ? sameDayStart + 1440 : sameDayStart;
  if (afternoonStart < morning.duration || afternoonStart + afternoon.duration > 1440) return null;

  return {
    label: `${morning.label} / ${afternoon.label}`,
    timeIn: morning.timeIn.clock,
    timeOut: afternoon.timeOut.clock,
  };
}
