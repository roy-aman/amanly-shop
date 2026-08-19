/* Formatting helpers shared across the app. */

export function money(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(amount));
  } catch {
    // Unknown currency code — fall back to a plain number with the code appended.
    return `${Number(amount).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Human-readable "2 hours ago" style relative time. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/**
 * What to call an order on screen.
 *
 * The order number is the reference a customer quotes on the phone and the one printed on their
 * confirmation email; eight characters of a UUID is neither, and matches nothing they hold. Orders
 * placed before numbering existed have none, so the short id stays as the fallback — keeping its
 * "#" so it still reads as a reference rather than as a fragment of something longer.
 *
 * Takes the shape rather than a named type so it serves both the summary rows and the full order.
 */
export function orderRef(order: { orderNumber?: string | null; id: string }): string {
  return order.orderNumber ?? `#${order.id.slice(0, 8)}`;
}

/* ===================================================================
   Store-timezone helpers (WP-BU.0)

   Appointments belong to the shop, not to the browser. A customer booking from
   another country must read the same clock face the shop's diary shows, or they
   will arrive at the wrong time — so every helper below takes the store's IANA
   zone explicitly and NONE of them falls back to the local one.

   `formatDate`/`formatDateTime` above render in the browser's zone and stay
   correct for order history ("when did I place this"). They are the wrong tool
   for anything the shop has to be open for.

   Deliberately built on Intl alone: the app carries no date library, and the two
   things that actually need care — reading a date in another zone, and doing
   calendar arithmetic on a YYYY-MM-DD string — are a few lines each.
   =================================================================== */

/** Today's date in the shop's zone as YYYY-MM-DD.
 *
 *  `new Date().toISOString().slice(0, 10)` is the trap this replaces: it answers
 *  in UTC, so for a shop in Asia/Kolkata it rolls over five and a half hours
 *  late, and an evening customer is offered "today" when the shop's today has
 *  already ended. 'en-CA' is used because its short date format IS ISO order. */
export function zonedToday(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

/** Calendar arithmetic on a YYYY-MM-DD string, with no zone involved at all.
 *
 *  Done through Date.UTC so it cannot drift: adding a day to a local Date on a
 *  daylight-saving boundary can land on the same date again. */
export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** ISO weekday for a YYYY-MM-DD string: 1 = Monday … 7 = Sunday.
 *
 *  The backend speaks ISO-8601 weekdays; JavaScript's `getDay()` is 0 = Sunday.
 *  Mixing the two shifts a whole week's opening hours by one day. */
export function weekdayFromISODate(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** ISO weekday number to its name. */
export function weekdayName(weekday: number, short = false): string {
  const name = WEEKDAY_NAMES[weekday - 1] ?? '—';
  return short ? name.slice(0, 3) : name;
}

function zoned(iso: string | null | undefined, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { ...options, timeZone }).format(d);
  } catch {
    // Unknown zone — better to show the browser's reading than nothing at all.
    return new Intl.DateTimeFormat(undefined, options).format(d);
  }
}

/** An instant as a time in the shop's zone: "2:30 PM". */
export function formatTimeInZone(iso: string | null | undefined, timeZone: string): string {
  return zoned(iso, timeZone, { hour: 'numeric', minute: '2-digit' });
}

/** An instant as a date in the shop's zone: "21 Aug 2026". */
export function formatDateInZone(iso: string | null | undefined, timeZone: string): string {
  return zoned(iso, timeZone, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** An instant as a full date and time in the shop's zone. */
export function formatDateTimeInZone(iso: string | null | undefined, timeZone: string): string {
  return zoned(iso, timeZone, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** A YYYY-MM-DD date string as a friendly label: "Fri 21 Aug". No zone needed —
 *  the string is already a calendar date rather than a moment. */
export function formatISODateLabel(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return date;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Minutes since local midnight in the shop's zone.
 *
 *  What a day view positions its blocks with: an appointment at 09:30 has to sit
 *  at 09:30 on the shop's ruler whatever the viewer's clock says. */
export function minutesInZone(iso: string, timeZone: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return hour * 60 + minute;
  } catch {
    return d.getHours() * 60 + d.getMinutes();
  }
}

/** The UTC instant of a wall-clock moment in the shop's zone.
 *
 *  The console needs it to ask for "everything on Tuesday": the server takes
 *  instants, and Tuesday means the shop's Tuesday. Solved by measuring how far
 *  the zone sits from UTC at roughly that moment and subtracting it — two passes,
 *  because the offset itself can change on a daylight-saving day. */
export function zonedWallClockToInstant(date: string, minutesOfDay: number, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, Math.floor(minutesOfDay / 60), minutesOfDay % 60);
  const offsetAt = (utcMs: number): number => {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(new Date(utcMs));
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
      return asUtc - utcMs;
    } catch {
      return 0;
    }
  };
  const firstPass = naive - offsetAt(naive);
  const instant = naive - offsetAt(firstPass);
  return new Date(instant).toISOString();
}

/** A wall-clock "HH:mm" string as a friendly time: "2:30 PM".
 *
 *  Pure string work on purpose. Availability already hands back a `localTime`
 *  label rendered in the shop's zone, and opening hours are wall clock with no
 *  date attached — turning either into a Date would invent a day and a zone that
 *  the value never had. */
export function formatWallClock(time: string | null | undefined): string {
  if (!time) return '—';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Minutes since midnight from a wall-clock "HH:mm". */
export function wallClockToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** "45 min", "1 hr", "1 hr 15 min" — how long an appointment takes. */
export function durationLabel(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(Number(minutes))) return '—';
  const total = Number(minutes);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}
