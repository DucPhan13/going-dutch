const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A calendar date, deliberately independent of timezone and clock time. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

/** Converts legacy ISO timestamps to their recorded calendar-date portion. */
export function toCalendarDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const candidate = value.slice(0, 10);
  return isCalendarDate(candidate) ? candidate : undefined;
}
