// Local calendar date utilities (never uses UTC for "today", avoiding off-by-one shifts).

const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayKey() {
  return formatDateKey(new Date());
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function addDays(key, delta) {
  const { y, m, d } = parseDateKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function daysBetween(startKey, endKey) {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey);
  const t1 = Date.UTC(a.y, a.m - 1, a.d);
  const t2 = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((t2 - t1) / 86400000);
}

export function formatLongDate(key) {
  const { y, m, d } = parseDateKey(key);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS_LONG[dow]}, ${d} de ${MONTHS[m - 1]}`;
}

export function formatShortTab(key, todayKey) {
  if (key === todayKey) return 'HOY';
  if (key === addDays(todayKey, -1)) return 'AYER';
  const { y, m, d } = parseDateKey(key);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS_SHORT[dow]} ${d}`;
}

export function formatMonthYear(year, monthIndex) {
  const name = MONTHS[monthIndex];
  return `${name[0].toUpperCase() + name.slice(1)} ${year}`;
}

export function msUntilNextLocalDay() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
