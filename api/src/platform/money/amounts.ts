import { BadRequestException } from '@nestjs/common';
import Big from 'big.js';

export const TOO_MANY_DECIMAL_PLACES_MESSAGE =
  'Số tiền có quá nhiều chữ số thập phân.';
export const INVALID_AMOUNT_MESSAGE = 'Số tiền không hợp lệ.';
export const POSITIVE_AMOUNT_MESSAGE = 'Số tiền phải lớn hơn 0.';
export const NON_NEGATIVE_AMOUNT_MESSAGE = 'Số tiền phải lớn hơn hoặc bằng 0.';

function normalizeMinor(minor: bigint | string | number) {
  if (typeof minor === 'bigint') {
    return minor;
  }

  if (typeof minor === 'number') {
    return BigInt(minor);
  }

  return BigInt(minor);
}

export function toMinorUnits(amount: string, precision: number): bigint {
  const factor = new Big(10).pow(precision);
  const normalized = new Big(amount).times(factor);

  if (!normalized.round(0, 0).eq(normalized)) {
    throw new Error(TOO_MANY_DECIMAL_PLACES_MESSAGE);
  }

  return BigInt(normalized.toFixed(0));
}

export function parsePositiveAmountToMinorUnits(
  amount: string,
  precision: number,
): bigint {
  let minorUnits: bigint;

  try {
    minorUnits = toMinorUnits(amount, precision);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === TOO_MANY_DECIMAL_PLACES_MESSAGE
    ) {
      throw new BadRequestException(error.message);
    }

    throw new BadRequestException(INVALID_AMOUNT_MESSAGE);
  }

  if (minorUnits <= 0n) {
    throw new BadRequestException(POSITIVE_AMOUNT_MESSAGE);
  }

  return minorUnits;
}

export function fromMinorUnits(
  minor: bigint | string | number,
  precision: number,
): string {
  const factor = new Big(10).pow(precision);
  return new Big(normalizeMinor(minor).toString())
    .div(factor)
    .toFixed(precision);
}

export function calculateFeeMinorUnits(input: {
  amountMinor: bigint;
  feeBps: number;
  precision: number;
  rounding: 'down' | 'up';
}) {
  if (input.amountMinor <= 0n || input.feeBps <= 0) {
    return 0n;
  }

  const rawFee = new Big(fromMinorUnits(input.amountMinor, input.precision))
    .times(input.feeBps)
    .div(10000);
  const roundedFee = rawFee.round(
    input.precision,
    input.rounding === 'up' ? Big.roundUp : Big.roundDown,
  );

  return toMinorUnits(roundedFee.toFixed(input.precision), input.precision);
}

export function applySignedAmount(
  current: bigint | string,
  direction: 'credit' | 'debit',
  amount: bigint | string,
) {
  const currentValue = normalizeMinor(current);
  const amountValue = normalizeMinor(amount);

  return direction === 'credit'
    ? currentValue + amountValue
    : currentValue - amountValue;
}
