import { BadRequestException } from '@nestjs/common';
import { getVietnamDayRangeUtc, isValidIsoDay } from './vietnam-day-range';

export type VietnamDateRangeQuery = {
  endDate: string;
  endExclusive: Date;
  start: Date;
  startDate: string;
};

export function parseVietnamDateRangeQuery(
  startDate?: string,
  endDate?: string,
): VietnamDateRangeQuery | undefined {
  if (!startDate && !endDate) {
    return undefined;
  }

  if (!startDate || !endDate) {
    throw new BadRequestException({
      code: 'invalid_review_date_range',
      message: 'Phải chọn đủ ngày bắt đầu và ngày kết thúc.',
    });
  }

  if (!isValidIsoDay(startDate) || !isValidIsoDay(endDate)) {
    throw new BadRequestException({
      code: 'invalid_review_date',
      message: 'Ngày lọc phải có định dạng YYYY-MM-DD.',
    });
  }

  if (startDate > endDate) {
    throw new BadRequestException({
      code: 'invalid_review_date_range',
      message: 'Ngày bắt đầu không được lớn hơn ngày kết thúc.',
    });
  }

  return {
    endDate,
    endExclusive: getVietnamDayRangeUtc(endDate).end,
    start: getVietnamDayRangeUtc(startDate).start,
    startDate,
  };
}
