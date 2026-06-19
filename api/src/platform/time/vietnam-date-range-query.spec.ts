import { BadRequestException } from '@nestjs/common';
import { parseVietnamDateRangeQuery } from './vietnam-date-range-query';

describe('vietnam-date-range-query', () => {
  it('returns undefined when both startDate and endDate are missing', () => {
    expect(parseVietnamDateRangeQuery()).toBeUndefined();
  });

  it('builds an inclusive vietnam date range with an exclusive end boundary', () => {
    const range = parseVietnamDateRangeQuery('2026-04-06', '2026-04-07');

    expect(range).toMatchObject({
      endDate: '2026-04-07',
      startDate: '2026-04-06',
    });
    expect(range?.start.toISOString()).toBe('2026-04-05T17:00:00.000Z');
    expect(range?.endExclusive.toISOString()).toBe('2026-04-07T17:00:00.000Z');
  });

  it('rejects incomplete, malformed, or reversed ranges', () => {
    expect(() => parseVietnamDateRangeQuery('2026-04-06', undefined)).toThrow(
      BadRequestException,
    );
    expect(() => parseVietnamDateRangeQuery('2026/04/06', '2026-04-07')).toThrow(
      BadRequestException,
    );
    expect(() => parseVietnamDateRangeQuery('2026-04-08', '2026-04-07')).toThrow(
      BadRequestException,
    );
  });
});
