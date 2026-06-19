import { describe, expect, it } from 'vitest';
import { getExchangeSummaryRows } from './summary';

describe('exchange summary ui', () => {
  it('shows receive amount, transaction fee, and total debit in the compact summary', () => {
    expect(
      getExchangeSummaryRows({
        feeAmount: '0.04',
        feeAssetCode: 'USDT',
        grossReceiveAmount: '3.84',
        receiveAmount: '3.80',
        sourceAssetCode: 'VND',
        targetAssetCode: 'USDT',
        totalDebit: '100000',
      }),
    ).toEqual([
      {
        label: 'Nhận được',
        value: '3.80 USDT',
      },
      {
        label: 'Quy đổi trước phí',
        value: '3.84 USDT',
      },
      {
        label: 'Phí giao dịch',
        value: '0.04 USDT',
      },
      {
        label: 'Tổng trừ',
        value: '100.000 VND',
      },
    ]);
  });
});
