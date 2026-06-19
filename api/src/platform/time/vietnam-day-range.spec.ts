import { getVietnamDayRangeUtc, isValidIsoDay } from './vietnam-day-range';

describe('vietnam-day-range', () => {
  it('validates YYYY-MM-DD filter values', () => {
    expect(isValidIsoDay('2026-04-06')).toBe(true);
    expect(isValidIsoDay('2026-4-6')).toBe(false);
    expect(isValidIsoDay('06-04-2026')).toBe(false);
  });

  it('builds UTC bounds for a Vietnam calendar day', () => {
    const range = getVietnamDayRangeUtc('2026-04-06');

    expect(range.start.toISOString()).toBe('2026-04-05T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-04-06T17:00:00.000Z');
  });
});
