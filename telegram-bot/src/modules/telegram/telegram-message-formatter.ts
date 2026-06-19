import type { AdminNotificationEvent } from '@nganluong/notification-contracts';

function formatMethodLabel(method: string) {
  if (method === 'bank_transfer') {
    return 'Chuyển khoản';
  }

  if (method === 'bep20') {
    return 'BEP20';
  }

  if (method === 'trc20') {
    return 'TRC20';
  }

  return method;
}

function formatTelegramAmount(amount: string, assetCode: string) {
  if (assetCode !== 'VND') {
    return amount;
  }

  const normalized = amount.trim();

  if (!/^-?\d+$/.test(normalized)) {
    return amount;
  }

  const isNegative = normalized.startsWith('-');
  const unsignedAmount = isNegative ? normalized.slice(1) : normalized;
  const groupedAmount = unsignedAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return isNegative ? `-${groupedAmount}` : groupedAmount;
}

function isMeaningfulDestinationPart(
  value: unknown,
): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim();

  if (!normalized) {
    return false;
  }

  return normalized.toLowerCase() !== 'n/a';
}

export function formatTelegramAdminAlert(event: AdminNotificationEvent) {
  if (event.eventType === 'deposit.pending.created') {
    const lines = [
      '🟢 THÔNG BÁO NẠP TIỀN',
      '',
      `🆔 Mã yêu cầu: ${event.payload.depositRequestId}`,
      `👤 Người dùng: ${event.payload.userEmail}`,
      `💰 Số tiền: ${formatTelegramAmount(event.payload.amount, event.payload.assetCode)} ${event.payload.assetCode}`,
      `🏦 Phương thức: ${formatMethodLabel(event.payload.method)}`,
    ];

    if (event.payload.selectedBankAccount) {
      lines.push(
        `🏛️ Tài khoản nhận: ${event.payload.selectedBankAccount.bankName} - ${event.payload.selectedBankAccount.accountNumber}`,
      );
    }

    if (event.payload.destinationRef) {
      lines.push(`📝 Nội dung CK: ${event.payload.destinationRef}`);
    }

    return lines.join('\n');
  }

  const destinationDetails = event.payload.destinationDetails;
  const lines = [
    '🔴 THÔNG BÁO RÚT TIỀN',
    '',
    `🆔 Mã yêu cầu: ${event.payload.withdrawalRequestId}`,
    `👤 Người dùng: ${event.payload.userEmail}`,
    `💰 Số tiền: ${formatTelegramAmount(event.payload.amount, event.payload.assetCode)} ${event.payload.assetCode}`,
    `💸 Phí: ${formatTelegramAmount(event.payload.feeAmount, event.payload.assetCode)} ${event.payload.assetCode}`,
    `📤 Tổng trừ: ${formatTelegramAmount(event.payload.totalDebit, event.payload.assetCode)} ${event.payload.assetCode}`,
    `🏦 Phương thức: ${formatMethodLabel(event.payload.method)}`,
  ];

  const destinationParts = destinationDetails
    ? [
        destinationDetails.bankName,
        destinationDetails.accountNumber,
        destinationDetails.accountName,
        destinationDetails.network,
        destinationDetails.walletAddress,
      ]
      .filter(isMeaningfulDestinationPart)
      .map((part) => part.trim())
    : [];

  if (destinationParts.length > 0) {
    lines.push(
      `📍 Thông tin nhận: ${destinationParts.join(' - ')}`,
    );
  }

  return lines.join('\n');
}
