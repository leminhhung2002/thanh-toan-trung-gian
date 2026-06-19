import { formatUsdt, formatVnd } from '#/lib/utils/format';

function formatAssetAmount(amount: string, assetCode: 'USDT' | 'VND') {
  return assetCode === 'VND'
    ? `${formatVnd(amount)} VND`
    : `${formatUsdt(amount)} USDT`;
}

export function getExchangeSummaryRows(input: {
  feeAmount: string;
  feeAssetCode: 'USDT' | 'VND';
  grossReceiveAmount: string;
  receiveAmount: string;
  sourceAssetCode: 'USDT' | 'VND';
  targetAssetCode: 'USDT' | 'VND';
  totalDebit: string;
}) {
  return [
    {
      label: 'Nhận được',
      value: formatAssetAmount(input.receiveAmount, input.targetAssetCode),
    },
    {
      label: 'Quy đổi trước phí',
      value: formatAssetAmount(input.grossReceiveAmount, input.targetAssetCode),
    },
    {
      label: 'Phí giao dịch',
      value: formatAssetAmount(input.feeAmount, input.feeAssetCode),
    },
    {
      label: 'Tổng trừ',
      value: formatAssetAmount(input.totalDebit, input.sourceAssetCode),
    },
  ];
}
