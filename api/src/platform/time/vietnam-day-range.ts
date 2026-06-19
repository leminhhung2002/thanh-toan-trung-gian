const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VIETNAM_UTC_OFFSET_HOURS = 7;

export function isValidIsoDay(value?: string | null) {
  return Boolean(value && ISO_DAY_PATTERN.test(value));
}

export function getVietnamDayRangeUtc(date: string) {
  const start = new Date(`${date}T00:00:00.000+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    end,
    start,
    utcOffsetHours: VIETNAM_UTC_OFFSET_HOURS,
  };
}
