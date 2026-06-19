import {
  INVALID_AMOUNT_MESSAGE,
  POSITIVE_AMOUNT_MESSAGE,
  TOO_MANY_DECIMAL_PLACES_MESSAGE,
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
  toMinorUnits,
} from './amounts';

describe('amount helpers', () => {
  it('converts decimal amounts into minor units', () => {
    expect(toMinorUnits('12.34', 2)).toBe(1234n);
  });

  it('formats minor units back to decimal strings', () => {
    expect(fromMinorUnits(1234n, 2)).toBe('12.34');
  });

  it('rejects zero and negative values for positive amount parsing', () => {
    expect(() => parsePositiveAmountToMinorUnits('0', 0)).toThrow(
      POSITIVE_AMOUNT_MESSAGE,
    );
    expect(() => parsePositiveAmountToMinorUnits('-1', 0)).toThrow(
      POSITIVE_AMOUNT_MESSAGE,
    );
  });

  it('rejects malformed numeric strings for positive amount parsing', () => {
    expect(() => parsePositiveAmountToMinorUnits('abc', 2)).toThrow(
      INVALID_AMOUNT_MESSAGE,
    );
  });

  it('rejects too many decimal places for positive amount parsing', () => {
    expect(() => parsePositiveAmountToMinorUnits('1.001', 2)).toThrow(
      TOO_MANY_DECIMAL_PLACES_MESSAGE,
    );
  });

  it('parses positive valid amounts into minor units', () => {
    expect(parsePositiveAmountToMinorUnits('12.34', 2)).toBe(1234n);
  });
});
