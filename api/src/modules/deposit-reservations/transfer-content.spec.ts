import { createDepositTransferContent } from './transfer-content';

describe('createDepositTransferContent', () => {
  it('formats the VND transfer content as CHUYENTIEN plus a 3-character alphanumeric suffix', () => {
    expect(createDepositTransferContent(() => '000')).toBe('CHUYENTIEN000');
    expect(createDepositTransferContent(() => 'A1B')).toBe('CHUYENTIENA1B');
    expect(createDepositTransferContent(() => 'Z9Y')).toBe('CHUYENTIENZ9Y');
  });

  it('always returns a stable customer-facing format', () => {
    expect(createDepositTransferContent(() => 'X7K')).toMatch(
      /^CHUYENTIEN[A-Z0-9]{3}$/,
    );
  });
});
