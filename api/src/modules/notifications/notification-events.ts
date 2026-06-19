import {
  ADMIN_NOTIFICATION_VERSION,
  type DepositPendingCreatedEvent,
  type DepositPendingCreatedPayload,
  type SelectedBankAccountPayload,
  type WithdrawalPendingCreatedEvent,
  type WithdrawalPendingCreatedPayload,
} from '@nganluong/notification-contracts';

type DepositPendingCreatedInput = Omit<
  DepositPendingCreatedPayload,
  'createdAt' | 'status'
> & {
  createdAt: Date;
};

type WithdrawalPendingCreatedInput = Omit<
  WithdrawalPendingCreatedPayload,
  'createdAt' | 'status'
> & {
  createdAt: Date;
};

export type SelectedBankAccountInput = SelectedBankAccountPayload;

export function buildDepositPendingCreatedEvent(
  input: DepositPendingCreatedInput,
): DepositPendingCreatedEvent {
  return {
    eventType: 'deposit.pending.created',
    occurredAt: input.createdAt.toISOString(),
    payload: {
      ...input,
      createdAt: input.createdAt.toISOString(),
      status: 'pending',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

export function buildWithdrawalPendingCreatedEvent(
  input: WithdrawalPendingCreatedInput,
): WithdrawalPendingCreatedEvent {
  return {
    eventType: 'withdrawal.pending.created',
    occurredAt: input.createdAt.toISOString(),
    payload: {
      ...input,
      createdAt: input.createdAt.toISOString(),
      status: 'pending',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}
