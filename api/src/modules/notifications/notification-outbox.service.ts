import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AppTransaction } from '../../platform/database/database.types';
import { notificationOutbox } from '../../platform/database/schema';
import {
  buildDepositPendingCreatedEvent,
  buildWithdrawalPendingCreatedEvent,
  type SelectedBankAccountInput,
} from './notification-events';

@Injectable()
export class NotificationOutboxService {
  async enqueueDepositPendingCreated(
    tx: AppTransaction,
    input: {
      amount: string;
      assetCode: string;
      createdAt: Date;
      depositRequestId: string;
      destinationRef: string | null;
      externalReference: string | null;
      method: string;
      note: string | null;
      proofUrl: string | null;
      selectedBankAccount: SelectedBankAccountInput | null;
      userEmail: string;
      userId: string;
    },
  ) {
    await this.insert(tx, {
      entityId: input.depositRequestId,
      entityType: 'deposit_request',
      event: buildDepositPendingCreatedEvent(input),
    });
  }

  async enqueueWithdrawalPendingCreated(
    tx: AppTransaction,
    input: {
      amount: string;
      assetCode: string;
      createdAt: Date;
      destinationDetails: Record<string, unknown> | null;
      feeAmount: string;
      method: string;
      note: string | null;
      totalDebit: string;
      userEmail: string;
      userId: string;
      withdrawalRequestId: string;
    },
  ) {
    await this.insert(tx, {
      entityId: input.withdrawalRequestId,
      entityType: 'withdrawal_request',
      event: buildWithdrawalPendingCreatedEvent(input),
    });
  }

  private async insert(
    tx: AppTransaction,
    input: {
      entityId: string;
      entityType: string;
      event: AdminNotificationEvent;
    },
  ) {
    await tx.insert(notificationOutbox).values({
      entityId: input.entityId,
      entityType: input.entityType,
      eventType: input.event.eventType,
      id: randomUUID(),
      payload: input.event,
    });
  }
}
