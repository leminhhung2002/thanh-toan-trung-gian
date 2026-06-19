import {
  ADMIN_NOTIFICATION_VERSION,
  type AdminNotificationEvent,
} from '@nganluong/notification-contracts';
import { formatTelegramAdminAlert } from './telegram-message-formatter';

function buildDepositEvent(method: string = 'bank_transfer'): AdminNotificationEvent {
  return {
    eventType: 'deposit.pending.created',
    occurredAt: '2026-04-04T10:00:00.000Z',
    payload: {
      amount: '100000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:00:00.000Z',
      depositRequestId: 'dep-1',
      destinationRef: 'NL dep-1',
      externalReference: 'mb-123',
      method,
      note: 'user said transferred',
      proofUrl: 'https://example.com/proof.png',
      selectedBankAccount: {
        accountName: 'NGAN LUONG',
        accountNumber: '0123456789',
        bankCode: '970436',
        bankName: 'Vietcombank',
        id: 'bank-1',
        priority: 1,
      },
      status: 'pending',
      userEmail: 'user@example.com',
      userId: 'user-1',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildDepositEventWithoutOptionalFields(): AdminNotificationEvent {
  return {
    eventType: 'deposit.pending.created',
    occurredAt: '2026-04-04T10:00:00.000Z',
    payload: {
      amount: '100000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:00:00.000Z',
      depositRequestId: 'dep-2',
      destinationRef: null,
      externalReference: null,
      method: 'bank_transfer',
      note: null,
      proofUrl: null,
      selectedBankAccount: null,
      status: 'pending',
      userEmail: 'user@example.com',
      userId: 'user-1',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEvent(): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '50000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails: {
        accountName: 'NGUYEN VAN A',
        accountNumber: '0987654321',
        bankName: 'ACB',
      },
      feeAmount: '500',
      method: 'bank_transfer',
      note: 'need cash',
      status: 'pending',
      totalDebit: '50500',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-1',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEventWithMethod(
  method: string,
  destinationDetails: Record<string, unknown> | null,
): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '10.000000',
      assetCode: 'USDT',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails,
      feeAmount: '0.500000',
      method,
      note: 'need cash',
      status: 'pending',
      totalDebit: '10.500000',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-crypto',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEventWithoutDestinationDetails(): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '50000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails: null,
      feeAmount: '500',
      method: 'bank_transfer',
      note: null,
      status: 'pending',
      totalDebit: '50500',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-2',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEventWithEmptyDestinationDetails(): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '50000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails: {
        accountName: '   ',
        accountNumber: '',
        bankName: '  ',
      },
      feeAmount: '500',
      method: 'bank_transfer',
      note: null,
      status: 'pending',
      totalDebit: '50500',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-3',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEventWithPlaceholderDestinationDetails(): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '50000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails: {
        accountName: 'n/a',
        accountNumber: 'N/A',
        bankName: 'n/a',
      },
      feeAmount: '500',
      method: 'bank_transfer',
      note: null,
      status: 'pending',
      totalDebit: '50500',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-4',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildWithdrawalEventWithPartialDestinationDetails(): AdminNotificationEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: '2026-04-04T10:05:00.000Z',
    payload: {
      amount: '50000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:05:00.000Z',
      destinationDetails: {
        bankName: 'ACB',
      },
      feeAmount: '500',
      method: 'bank_transfer',
      note: null,
      status: 'pending',
      totalDebit: '50500',
      userEmail: 'user@example.com',
      userId: 'user-1',
      withdrawalRequestId: 'wd-5',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function expectNoRawBackendNoise(
  message: string,
  noiseTerms: string[],
) {
  for (const term of noiseTerms) {
    expect(message).not.toContain(term);
  }
}

describe('formatTelegramAdminAlert', () => {
  it('renders deposit review details in concise Vietnamese', () => {
    const message = formatTelegramAdminAlert(buildDepositEvent());

    expect(message).toBe(
      [
        '🟢 THÔNG BÁO NẠP TIỀN',
        '',
        '🆔 Mã yêu cầu: dep-1',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 100.000 VND',
        '🏦 Phương thức: Chuyển khoản',
        '🏛️ Tài khoản nhận: Vietcombank - 0123456789',
        '📝 Nội dung CK: NL dep-1',
      ].join('\n'),
    );
    expectNoRawBackendNoise(message, [
      'proofUrl',
      'externalReference',
      'createdAt',
    ]);
  });

  it('maps bep20 deposit methods to BEP20', () => {
    const message = formatTelegramAdminAlert(buildDepositEvent('bep20'));

    expect(message).toContain('🏦 Phương thức: BEP20');
  });

  it('maps trc20 withdrawal methods to TRC20', () => {
    const message = formatTelegramAdminAlert(
      buildWithdrawalEventWithMethod('trc20', {
        method: 'trc20',
        network: 'TRC20',
        walletAddress: 'TXYZ123',
      }),
    );

    expect(message).toContain('🏦 Phương thức: TRC20');
  });

  it('omits deposit bank and transfer lines when the data is missing', () => {
    const message = formatTelegramAdminAlert(buildDepositEventWithoutOptionalFields());

    expect(message).toBe(
      [
        '🟢 THÔNG BÁO NẠP TIỀN',
        '',
        '🆔 Mã yêu cầu: dep-2',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 100.000 VND',
        '🏦 Phương thức: Chuyển khoản',
      ].join('\n'),
    );
    expect(message).not.toContain('🏛️ Tài khoản nhận:');
    expect(message).not.toContain('📝 Nội dung CK:');
    expect(message).not.toContain('n/a');
    expectNoRawBackendNoise(message, ['proofUrl', 'externalReference']);
  });

  it('renders withdrawal review details into a readable admin alert', () => {
    const message = formatTelegramAdminAlert(buildWithdrawalEvent());

    expect(message).toBe(
      [
        '🔴 THÔNG BÁO RÚT TIỀN',
        '',
        '🆔 Mã yêu cầu: wd-1',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 50.000 VND',
        '💸 Phí: 500 VND',
        '📤 Tổng trừ: 50.500 VND',
        '🏦 Phương thức: Chuyển khoản',
        '📍 Thông tin nhận: ACB - 0987654321 - NGUYEN VAN A',
      ].join('\n'),
    );
    expectNoRawBackendNoise(message, ['createdAt']);
  });

  it('omits withdrawal destination details when they are missing', () => {
    const message = formatTelegramAdminAlert(
      buildWithdrawalEventWithoutDestinationDetails(),
    );

    expect(message).toBe(
      [
        '🔴 THÔNG BÁO RÚT TIỀN',
        '',
        '🆔 Mã yêu cầu: wd-2',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 50.000 VND',
        '💸 Phí: 500 VND',
        '📤 Tổng trừ: 50.500 VND',
        '🏦 Phương thức: Chuyển khoản',
      ].join('\n'),
    );
    expect(message).not.toContain('📍 Thông tin nhận:');
    expect(message).not.toContain('n/a');
    expectNoRawBackendNoise(message, ['createdAt', 'user-1']);
  });

  it('omits withdrawal destination details when they are empty', () => {
    const message = formatTelegramAdminAlert(
      buildWithdrawalEventWithEmptyDestinationDetails(),
    );

    expect(message).toBe(
      [
        '🔴 THÔNG BÁO RÚT TIỀN',
        '',
        '🆔 Mã yêu cầu: wd-3',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 50.000 VND',
        '💸 Phí: 500 VND',
        '📤 Tổng trừ: 50.500 VND',
        '🏦 Phương thức: Chuyển khoản',
      ].join('\n'),
    );
    expect(message).not.toContain('📍 Thông tin nhận:');
    expectNoRawBackendNoise(message, ['createdAt', 'user-1']);
  });

  it('omits withdrawal destination details when they are placeholders', () => {
    const message = formatTelegramAdminAlert(
      buildWithdrawalEventWithPlaceholderDestinationDetails(),
    );

    expect(message).toBe(
      [
        '🔴 THÔNG BÁO RÚT TIỀN',
        '',
        '🆔 Mã yêu cầu: wd-4',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 50.000 VND',
        '💸 Phí: 500 VND',
        '📤 Tổng trừ: 50.500 VND',
        '🏦 Phương thức: Chuyển khoản',
      ].join('\n'),
    );
    expect(message).not.toContain('📍 Thông tin nhận:');
    expect(message).not.toContain('n/a');
    expectNoRawBackendNoise(message, ['createdAt', 'user-1']);
  });

  it('renders partial withdrawal destination details without undefined segments', () => {
    const message = formatTelegramAdminAlert(
      buildWithdrawalEventWithPartialDestinationDetails(),
    );

    expect(message).toBe(
      [
        '🔴 THÔNG BÁO RÚT TIỀN',
        '',
        '🆔 Mã yêu cầu: wd-5',
        '👤 Người dùng: user@example.com',
        '💰 Số tiền: 50.000 VND',
        '💸 Phí: 500 VND',
        '📤 Tổng trừ: 50.500 VND',
        '🏦 Phương thức: Chuyển khoản',
        '📍 Thông tin nhận: ACB',
      ].join('\n'),
    );
    expect(message).not.toContain('undefined');
    expectNoRawBackendNoise(message, ['createdAt', 'user-1']);
  });
});
