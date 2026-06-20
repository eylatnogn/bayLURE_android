/** Local "YYYY-MM-DD" for a Date. */
export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 86400000);
}

/** Compact "YYYYMMDD" for NOAA. */
export function yyyymmdd(date: Date): string {
  return localDateStr(date).replace(/-/g, '');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short day label for the forecast strip, e.g. "Today" / "Sat". */
export function dayLabel(date: Date, offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tom';
  return WEEKDAYS[date.getDay()] ?? '';
}

/** Long label for the conditions header, e.g. "Saturday, Jun 21". */
export function longDayLabel(date: Date, offset: number): string {
  const weekday = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ][date.getDay()];
  const md = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  if (offset === 0) return `Today · ${md}`;
  return `${weekday} · ${md}`;
}

export function dayNumber(date: Date): string {
  return String(date.getDate());
}

/** "2026-06-21T06:00" -> "6 AM". */
export function hourLabel(iso: string): string {
  const hStr = iso.split('T')[1]?.slice(0, 2);
  const h = hStr ? Number(hStr) : NaN;
  if (Number.isNaN(h)) return '';
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

/** Hour (0-23) from an ISO local time string. */
export function hourOf(iso: string): number {
  const hStr = iso.split('T')[1]?.slice(0, 2);
  return hStr ? Number(hStr) : NaN;
}
