const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${timezone}|${JSON.stringify(options)}`;
  let cached = formatters.get(key);

  if (!cached) {
    cached = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      ...options,
    });
    formatters.set(key, cached);
  }

  return cached;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function dateIn(timezone: string, date: Date): string {
  return formatter(timezone, { dateStyle: 'short' }).format(date);
}

export function timeIn(timezone: string, date: Date): string {
  return formatter(timezone, { timeStyle: 'short' }).format(date);
}

export function offsetMs(timezone: string, date: Date): number {
  const name = formatter(timezone, { timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;
  // ICU renders the sign of a negative offset as U+2212 (−), not as a hyphen.
  const match = /^GMT([+\u2212-])(\d{1,2}):(\d{2})$/.exec(name ?? '');

  if (!match) {
    return 0;
  }

  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000;
}

export function startOfDay(date: Date, timezone: string): Date {
  const [year, month, day] = dateIn(timezone, date).split('-').map(Number);
  const localMidnight = Date.UTC(year, month - 1, day);
  const offset = offsetMs(timezone, date);
  const start = new Date(localMidnight - offset);
  const corrected = offsetMs(timezone, start);

  return corrected === offset ? start : new Date(localMidnight - corrected);
}
