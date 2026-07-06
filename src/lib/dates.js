// All dates in the app are local-time 'YYYY-MM-DD' strings — the day you ate is
// the day you logged, regardless of timezone.

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function diffDays(a, b) {
  // whole days from a to b (b - a)
  return Math.round((parseDateStr(b) - parseDateStr(a)) / 86400000);
}

export function dateRange(startStr, endStr) {
  const out = [];
  let cur = startStr;
  while (cur <= endStr) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function lastNDays(n, endStr = todayStr()) {
  return dateRange(addDays(endStr, -(n - 1)), endStr);
}

export function weekdayIndex(dateStr) {
  return parseDateStr(dateStr).getDay(); // 0 = Sunday
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtShort(dateStr) {
  const d = parseDateStr(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function fmtLong(dateStr) {
  const d = parseDateStr(dateStr);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function isToday(dateStr) {
  return dateStr === todayStr();
}
