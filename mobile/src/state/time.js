export const APP_TIME_ZONE = 'Africa/Dar_es_Salaam';

const EAT_OFFSET_MINUTES = 180; // UTC+3, no DST

function toValidDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function format12h(hours24, minutes) {
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const h = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h}:${pad2(minutes)} ${ampm}`;
}

function weekdayShortFromIndex(idx) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx] ?? '';
}

function addUtcMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatTimeEAT(value, { weekday = false } = {}) {
  const d = toValidDate(value);
  if (!d) return null;

  // Prefer Intl with explicit tz when available.
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      weekday: weekday ? 'short' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    });
    return fmt.format(d);
  } catch {
    // Manual fixed-offset formatter (works even if Intl timeZone is missing).
    const eat = addUtcMinutes(d, EAT_OFFSET_MINUTES);
    const time = format12h(eat.getUTCHours(), eat.getUTCMinutes());
    if (!weekday) return time;
    return `${weekdayShortFromIndex(eat.getUTCDay())} ${time}`;
  }
}

export function formatWeekdayEAT(value) {
  const d = toValidDate(value);
  if (!d) return null;

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_TIME_ZONE,
      weekday: 'short',
    }).format(d);
  } catch {
    const eat = addUtcMinutes(d, EAT_OFFSET_MINUTES);
    return weekdayShortFromIndex(eat.getUTCDay());
  }
}
