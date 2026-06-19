export const ADMIN_NOTIFICATION_VERSION = 1 as const;
export const TELEGRAM_RUNTIME_CONFIG_VERSION = 1 as const;

export const adminNotificationEventTypes = [
  'deposit.pending.created',
  'withdrawal.pending.created',
] as const;

export const telegramRuntimeConfigEventTypes = [
  'telegram.config.updated',
] as const;

export type AdminNotificationEventType =
  (typeof adminNotificationEventTypes)[number];
export type TelegramRuntimeConfigEventType =
  (typeof telegramRuntimeConfigEventTypes)[number];

export type SelectedBankAccountPayload = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  id: string;
  priority: number;
};

export type DepositPendingCreatedPayload = {
  depositRequestId: string;
  userId: string;
  userEmail: string;
  assetCode: string;
  amount: string;
  method: string;
  status: 'pending';
  createdAt: string;
  selectedBankAccount: SelectedBankAccountPayload | null;
  destinationRef: string | null;
  externalReference: string | null;
  proofUrl: string | null;
  note: string | null;
};

export type WithdrawalPendingCreatedPayload = {
  withdrawalRequestId: string;
  userId: string;
  userEmail: string;
  assetCode: string;
  amount: string;
  feeAmount: string;
  totalDebit: string;
  method: string;
  status: 'pending';
  createdAt: string;
  destinationDetails: Record<string, unknown> | null;
  note: string | null;
};

export type DepositPendingCreatedEvent = {
  version: typeof ADMIN_NOTIFICATION_VERSION;
  eventType: 'deposit.pending.created';
  occurredAt: string;
  payload: DepositPendingCreatedPayload;
};

export type WithdrawalPendingCreatedEvent = {
  version: typeof ADMIN_NOTIFICATION_VERSION;
  eventType: 'withdrawal.pending.created';
  occurredAt: string;
  payload: WithdrawalPendingCreatedPayload;
};

export type TelegramConfigUpdatedPayload = {
  updatedAt: string;
  version: number;
};

export type TelegramConfigUpdatedEvent = {
  version: typeof TELEGRAM_RUNTIME_CONFIG_VERSION;
  eventType: 'telegram.config.updated';
  occurredAt: string;
  payload: TelegramConfigUpdatedPayload;
};

export type AdminNotificationEvent =
  | DepositPendingCreatedEvent
  | WithdrawalPendingCreatedEvent;
