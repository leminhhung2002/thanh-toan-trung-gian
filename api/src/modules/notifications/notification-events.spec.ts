import { ADMIN_NOTIFICATION_VERSION } from '@nganluong/notification-contracts';
import {
  buildDepositPendingCreatedEvent,
  buildWithdrawalPendingCreatedEvent,
} from './notification-events';

describe('notification event builders', () => {
  it('builds a deposit pending event with the selected bank account details', () => {
    const createdAt = new Date('2026-04-04T09:30:00.000Z');

    expect(
      buildDepositPendingCreatedEvent({
        amount: '100000',
        assetCode: 'VND',
        createdAt,
        depositRequestId: 'dep-1',
        destinationRef: 'NL dep-1',
        externalReference: 'mbbank-123',
        method: 'bank_transfer',
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
        userEmail: 'user@example.com',
        userId: 'user-1',
      }),
    ).toEqual({
      eventType: 'deposit.pending.created',
      occurredAt: createdAt.toISOString(),
      payload: {
        amount: '100000',
        assetCode: 'VND',
        createdAt: createdAt.toISOString(),
        depositRequestId: 'dep-1',
        destinationRef: 'NL dep-1',
        externalReference: 'mbbank-123',
        method: 'bank_transfer',
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
    });
  });

  it('builds a withdrawal pending event with debit totals and destination details', () => {
    const createdAt = new Date('2026-04-04T09:45:00.000Z');

    expect(
      buildWithdrawalPendingCreatedEvent({
        amount: '250000',
        assetCode: 'VND',
        createdAt,
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '0987654321',
          bankName: 'ACB',
        },
        feeAmount: '2500',
        method: 'bank_transfer',
        note: 'withdraw to bank',
        totalDebit: '252500',
        userEmail: 'user@example.com',
        userId: 'user-1',
        withdrawalRequestId: 'wd-1',
      }),
    ).toEqual({
      eventType: 'withdrawal.pending.created',
      occurredAt: createdAt.toISOString(),
      payload: {
        amount: '250000',
        assetCode: 'VND',
        createdAt: createdAt.toISOString(),
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '0987654321',
          bankName: 'ACB',
        },
        feeAmount: '2500',
        method: 'bank_transfer',
        note: 'withdraw to bank',
        status: 'pending',
        totalDebit: '252500',
        userEmail: 'user@example.com',
        userId: 'user-1',
        withdrawalRequestId: 'wd-1',
      },
      version: ADMIN_NOTIFICATION_VERSION,
    });
  });
});
