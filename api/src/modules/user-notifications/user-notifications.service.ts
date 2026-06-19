import { Injectable, Inject } from '@nestjs/common';
import type { AppTransaction } from '../../platform/database/database.types';
import type { UserNotificationsRepository } from './user-notifications.repository';

type BaseNotificationInput = {
  createdAt?: Date;
  primaryAmount: string;
  primaryAmountTone: 'minus' | 'neutral' | 'plus';
  primaryAssetCode: string;
  referenceId: string;
  referenceType: string;
  secondaryText: string;
  title: string;
  type: string;
  userId: string;
};

@Injectable()
export class UserNotificationsService {
  constructor(
    @Inject('UserNotificationsRepository')
    private readonly repository: UserNotificationsRepository,
  ) {}

  async createForUser(input: BaseNotificationInput) {
    await this.repository.save(input);
  }

  async listForUser(userId: string, limit = 50) {
    const normalizedLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);
    const [items, unreadCount] = await Promise.all([
      this.repository.listForUser(userId, normalizedLimit),
      this.repository.countUnreadForUser(userId),
    ]);

    return {
      items: items.map((item) => ({
        createdAt: item.createdAt.toISOString(),
        id: item.id,
        primaryAmount: item.primaryAmount,
        primaryAmountTone: item.primaryAmountTone,
        primaryAssetCode: item.primaryAssetCode,
        referenceId: item.referenceId,
        referenceType: item.referenceType,
        secondaryText: item.secondaryText,
        title: item.title,
        type: item.type,
      })),
      unreadCount,
    };
  }

  async getUnreadCount(userId: string) {
    return {
      count: await this.repository.countUnreadForUser(userId),
    };
  }

  async markAllRead(userId: string) {
    const latestCreatedAt = await this.repository.findLatestCreatedAtForUser(userId);

    if (!latestCreatedAt) {
      return {
        count: 0,
        readAt: null,
      };
    }

    await this.repository.markAllRead(userId, latestCreatedAt);

    return {
      count: 0,
      readAt: latestCreatedAt.toISOString(),
    };
  }

  createDepositApproved(
    tx: AppTransaction,
    input: {
      amount: string;
      assetCode: string;
      depositRequestId: string;
      userId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.amount,
      primaryAmountTone: 'plus',
      primaryAssetCode: input.assetCode,
      referenceId: input.depositRequestId,
      referenceType: 'deposit_request',
      secondaryText: `Đã cộng vào ví ${input.assetCode}`,
      title: 'Nạp tiền',
      type: 'deposit.approved',
      userId: input.userId,
    });
  }

  createDepositRejected(
    tx: AppTransaction,
    input: {
      amount: string;
      assetCode: string;
      depositRequestId: string;
      reviewNote?: string;
      userId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.amount,
      primaryAmountTone: 'neutral',
      primaryAssetCode: input.assetCode,
      referenceId: input.depositRequestId,
      referenceType: 'deposit_request',
      secondaryText:
        input.reviewNote?.trim() || 'Yêu cầu nạp tiền đã bị từ chối',
      title: 'Nạp tiền',
      type: 'deposit.rejected',
      userId: input.userId,
    });
  }

  createWithdrawalApproved(
    tx: AppTransaction,
    input: {
      assetCode: string;
      totalDebit: string;
      userId: string;
      withdrawalRequestId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.totalDebit,
      primaryAmountTone: 'minus',
      primaryAssetCode: input.assetCode,
      referenceId: input.withdrawalRequestId,
      referenceType: 'withdrawal_request',
      secondaryText: 'Yêu cầu rút tiền đã được duyệt',
      title: 'Rút tiền',
      type: 'withdrawal.approved',
      userId: input.userId,
    });
  }

  createWithdrawalRejected(
    tx: AppTransaction,
    input: {
      assetCode: string;
      totalDebit: string;
      userId: string;
      withdrawalRequestId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.totalDebit,
      primaryAmountTone: 'plus',
      primaryAssetCode: input.assetCode,
      referenceId: input.withdrawalRequestId,
      referenceType: 'withdrawal_request',
      secondaryText: 'Số tiền đã được hoàn lại vào ví',
      title: 'Rút tiền',
      type: 'withdrawal.rejected',
      userId: input.userId,
    });
  }

  createExchangeCompleted(
    tx: AppTransaction,
    input: {
      fromAssetCode: string;
      referenceId: string;
      toAmount: string;
      toAssetCode: string;
      totalDebit: string;
      userId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.toAmount,
      primaryAmountTone: 'plus',
      primaryAssetCode: input.toAssetCode,
      referenceId: input.referenceId,
      referenceType: 'exchange_order',
      secondaryText: `Đã trừ ${input.totalDebit} ${input.fromAssetCode}`,
      title: 'Đổi tiền',
      type: 'exchange.completed',
      userId: input.userId,
    });
  }

  createExchangeReversed(
    tx: AppTransaction,
    input: {
      fromAssetCode: string;
      referenceId: string;
      toAmount: string;
      toAssetCode: string;
      totalDebit: string;
      userId: string;
    },
  ) {
    return this.repository.saveWithTransaction(tx, {
      primaryAmount: input.toAmount,
      primaryAmountTone: 'neutral',
      primaryAssetCode: input.toAssetCode,
      referenceId: input.referenceId,
      referenceType: 'exchange_order',
      secondaryText: `Đã hoàn lại ${input.totalDebit} ${input.fromAssetCode} và thu hồi số tiền nhận trước đó`,
      title: 'Đổi tiền',
      type: 'exchange.reversed',
      userId: input.userId,
    });
  }
}
