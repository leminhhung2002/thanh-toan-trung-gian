import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, lt, ne, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { ExchangePricingService } from '../exchange/exchange-pricing.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { SettingsService } from '../settings/settings.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { matchesAdminUserSearch } from '../users/admin-user-search';
import { PasswordConfirmationService } from '../users/password-confirmation.service';
import { WalletsService } from '../wallets/wallets.service';
import { DatabaseService } from '../../platform/database/database.service';
import type { VietnamDateRangeQuery } from '../../platform/time/vietnam-date-range-query';
import {
  calculateFeeMinorUnits,
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
} from '../../platform/money/amounts';
import {
  assets,
  users,
  withdrawalRequests,
} from '../../platform/database/schema';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'all';
const USER_CANCELLED_WITHDRAWAL_NOTE = 'Hủy bởi người dùng';

function normalizeDestinationDetails(
  value: Record<string, unknown> | string | null,
) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { raw: value };
    }
  }

  return value;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
    private readonly exchangePricingService: ExchangePricingService,
    private readonly idempotencyService: IdempotencyService,
    private readonly ledgerService: LedgerService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly settingsService: SettingsService,
    private readonly passwordConfirmationService: PasswordConfirmationService,
    private readonly walletsService: WalletsService,
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateWithdrawalDto,
    idempotencyKey: string,
  ) {
    await this.passwordConfirmationService.assertValidCurrentPassword(
      userId,
      dto.currentPassword,
    );

    await this.idempotencyService.claim(
      userId,
      'withdrawal:create',
      idempotencyKey,
    );

    const asset = await this.assetsService.findByCode(dto.assetCode);
    if (!asset) {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Không tìm thấy tài sản.',
      });
    }

    if (asset.code !== 'VND' && asset.code !== 'USDT') {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Không tìm thấy tài sản.',
      });
    }

    const totalDebitMinor = parsePositiveAmountToMinorUnits(
      dto.amount,
      asset.assetPrecision,
    );
    const feeBps = await this.settingsService.getWithdrawalFeeBps(asset.code);
    const feeAmountMinor = calculateFeeMinorUnits({
      amountMinor: totalDebitMinor,
      feeBps,
      precision: asset.assetPrecision,
      rounding: 'up',
    });
    const amountMinor = totalDebitMinor - feeAmountMinor;

    if (amountMinor <= 0n) {
      throw new BadRequestException({
        code: 'withdrawal_amount_below_fee',
        message: 'Số tiền rút phải lớn hơn phí giao dịch để nhận được tiền.',
      });
    }
    const wallet = await this.walletsService.getWalletByUserAndAssetCode(
      userId,
      dto.assetCode,
    );
    const [user] = await this.databaseService.db
      .select({
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException({
        code: 'user_not_found',
        message: 'Không tìm thấy người dùng.',
      });
    }

    const withdrawalId = randomUUID();
    const createdAt = new Date();

    await this.databaseService.db.transaction(async (tx) => {
      await tx.insert(withdrawalRequests).values({
        id: withdrawalId,
        userId,
        assetId: asset.id,
        amountMinor,
        createdAt,
        feeAmountMinor,
        feeProfitVndMinor: 0n,
        method: dto.method,
        destinationDetails: dto.destinationDetails ?? null,
        note: dto.note ?? null,
        profitFxRateVnd: null,
        totalDebitMinor,
      });

      await this.notificationOutboxService.enqueueWithdrawalPendingCreated(tx, {
        amount: fromMinorUnits(amountMinor, asset.assetPrecision),
        assetCode: asset.code,
        createdAt,
        destinationDetails: dto.destinationDetails ?? null,
        feeAmount: fromMinorUnits(feeAmountMinor, asset.assetPrecision),
        method: dto.method,
        note: dto.note ?? null,
        totalDebit: fromMinorUnits(totalDebitMinor, asset.assetPrecision),
        userEmail: user.email,
        userId,
        withdrawalRequestId: withdrawalId,
      });

      await this.ledgerService.reserveAvailableToPending(
        tx,
        wallet.walletId,
        totalDebitMinor,
        'withdrawal_request',
        withdrawalId,
        dto.note,
        idempotencyKey,
      );

    });

    await this.auditService.log({
      actorUserId: userId,
      action: 'withdrawal.created',
      entityType: 'withdrawal_request',
      entityId: withdrawalId,
      metadata: { amount: dto.amount, assetCode: asset.code },
    });

    return {
      assetCode: asset.code,
      amount: fromMinorUnits(amountMinor, asset.assetPrecision),
      feeAmount: fromMinorUnits(feeAmountMinor, asset.assetPrecision),
      id: withdrawalId,
      status: 'pending',
      totalDebit: fromMinorUnits(totalDebitMinor, asset.assetPrecision),
    };
  }

  async listForUser(userId: string) {
    const rows = await this.databaseService.db
      .select({
        id: withdrawalRequests.id,
        amountMinor: withdrawalRequests.amountMinor,
        assetCode: assets.code,
        approvedAt: withdrawalRequests.approvedAt,
        cancelledAt: withdrawalRequests.cancelledAt,
        destinationDetails: withdrawalRequests.destinationDetails,
        feeAmountMinor: withdrawalRequests.feeAmountMinor,
        feeProfitVndMinor: withdrawalRequests.feeProfitVndMinor,
        precision: assets.assetPrecision,
        method: withdrawalRequests.method,
        note: withdrawalRequests.note,
        profitFxRateVnd: withdrawalRequests.profitFxRateVnd,
        rejectedAt: withdrawalRequests.rejectedAt,
        reviewNote: withdrawalRequests.reviewNote,
        status: withdrawalRequests.status,
        totalDebitMinor: withdrawalRequests.totalDebitMinor,
        createdAt: withdrawalRequests.createdAt,
      })
      .from(withdrawalRequests)
      .innerJoin(assets, eq(withdrawalRequests.assetId, assets.id))
      .where(eq(withdrawalRequests.userId, userId))
      .orderBy(desc(withdrawalRequests.createdAt));

    return rows.map((row) => ({
      id: row.id,
      amount: fromMinorUnits(row.amountMinor, row.precision),
      assetCode: row.assetCode,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      destinationDetails: normalizeDestinationDetails(row.destinationDetails),
      feeAmount: fromMinorUnits(row.feeAmountMinor, row.precision),
      feeProfitVnd: fromMinorUnits(row.feeProfitVndMinor, 0),
      method: row.method,
      note: row.note,
      profitFxRateVnd: row.profitFxRateVnd ? String(row.profitFxRateVnd) : null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      status: row.status,
      totalDebit: fromMinorUnits(row.totalDebitMinor, row.precision),
    }));
  }

  async listForAdmin(
    status: ReviewStatus,
    dateRange?: VietnamDateRangeQuery,
    search?: string,
  ) {
    const query = this.databaseService.db
      .select({
        id: withdrawalRequests.id,
        userId: withdrawalRequests.userId,
        userEmail: users.email,
        userPhone: users.phone,
        amountMinor: withdrawalRequests.amountMinor,
        assetCode: assets.code,
        feeAmountMinor: withdrawalRequests.feeAmountMinor,
        feeProfitVndMinor: withdrawalRequests.feeProfitVndMinor,
        precision: assets.assetPrecision,
        method: withdrawalRequests.method,
        status: withdrawalRequests.status,
        note: withdrawalRequests.note,
        reviewNote: withdrawalRequests.reviewNote,
        destinationDetails: withdrawalRequests.destinationDetails,
        profitFxRateVnd: withdrawalRequests.profitFxRateVnd,
        totalDebitMinor: withdrawalRequests.totalDebitMinor,
        createdAt: withdrawalRequests.createdAt,
        approvedAt: withdrawalRequests.approvedAt,
        rejectedAt: withdrawalRequests.rejectedAt,
      })
      .from(withdrawalRequests)
      .innerJoin(assets, eq(withdrawalRequests.assetId, assets.id))
      .innerJoin(users, eq(withdrawalRequests.userId, users.id))
      .orderBy(desc(withdrawalRequests.createdAt));

    const filters: SQL[] = [ne(withdrawalRequests.status, 'cancelled')];

    if (status !== 'all') {
      filters.push(eq(withdrawalRequests.status, status));
    }

    if (dateRange) {
      filters.push(gte(withdrawalRequests.createdAt, dateRange.start));
      filters.push(lt(withdrawalRequests.createdAt, dateRange.endExclusive));
    }

    const rows =
      filters.length === 0
        ? await query
        : await query.where(and(...filters));

    const filteredRows = rows.filter((row) =>
      matchesAdminUserSearch(
        {
          userEmail: row.userEmail,
          userId: row.userId,
          userPhone: row.userPhone,
        },
        search,
      ),
    );

    return filteredRows.map((row) => ({
      id: row.id,
      userId: row.userId,
      userEmail: row.userEmail,
      userPhone: row.userPhone,
      amount: fromMinorUnits(row.amountMinor, row.precision),
      assetCode: row.assetCode,
      feeAmount: fromMinorUnits(row.feeAmountMinor, row.precision),
      feeProfitVnd: fromMinorUnits(row.feeProfitVndMinor, 0),
      method: row.method,
      status: row.status,
      note: row.note,
      reviewNote: row.reviewNote,
      destinationDetails: normalizeDestinationDetails(row.destinationDetails),
      profitFxRateVnd: row.profitFxRateVnd ? String(row.profitFxRateVnd) : null,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      totalDebit: fromMinorUnits(row.totalDebitMinor, row.precision),
    }));
  }

  async cancel(userId: string, withdrawalId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [withdrawal] = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId))
        .for('update');

      if (!withdrawal || withdrawal.userId !== userId) {
        throw new NotFoundException({
          code: 'withdrawal_not_found',
          message: 'Không tìm thấy yêu cầu rút tiền.',
        });
      }

      if (withdrawal.status !== 'pending') {
        throw new ConflictException({
          code: 'withdrawal_cancel_invalid_state',
          message: 'Yêu cầu rút tiền này hiện không còn ở trạng thái có thể hủy.',
        });
      }

      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        withdrawal.userId,
        withdrawal.assetId,
      );
      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

      if (lockedWallet.pendingMinor < withdrawal.totalDebitMinor) {
        throw new ConflictException({
          code: 'withdrawal_cancel_rollback_mismatch',
          message:
            'Số dư chờ xử lý hiện không còn khớp để hoàn tác yêu cầu rút tiền này.',
        });
      }

      await this.ledgerService.releasePendingToAvailable(
        tx,
        lockedWallet.id,
        withdrawal.totalDebitMinor,
        'withdrawal_request',
        withdrawal.id,
        USER_CANCELLED_WITHDRAWAL_NOTE,
        undefined,
        lockedWallet,
      );

      await tx
        .update(withdrawalRequests)
        .set({
          cancelledAt: new Date(),
          reviewNote: USER_CANCELLED_WITHDRAWAL_NOTE,
          status: 'cancelled',
        })
        .where(
          and(
            eq(withdrawalRequests.id, withdrawal.id),
            eq(withdrawalRequests.status, 'pending'),
          ),
        );

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'withdrawal.cancelled_by_user',
        entityType: 'withdrawal_request',
        entityId: withdrawal.id,
        metadata: {
          totalDebitMinor: withdrawal.totalDebitMinor.toString(),
        },
      });
    });

    return { success: true };
  }

  async approve(
    adminUserId: string,
    withdrawalId: string,
    reviewNote?: string,
  ) {
    await this.databaseService.db.transaction(async (tx) => {
      const [withdrawal] = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId))
        .for('update');

      if (!withdrawal) {
        throw new NotFoundException({
          code: 'withdrawal_not_found',
          message: 'Không tìm thấy yêu cầu rút tiền.',
        });
      }

      if (withdrawal.status !== 'pending') {
        throw new ConflictException({
          code: 'withdrawal_already_reviewed',
          message: 'Yêu cầu rút tiền này đã được xử lý trước đó.',
        });
      }

      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        withdrawal.userId,
        withdrawal.assetId,
      );
      const asset = await this.assetsService.findById(withdrawal.assetId);

      if (!asset) {
        throw new NotFoundException({
          code: 'asset_not_found',
          message: 'Không tìm thấy tài sản.',
        });
      }

      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);
      const profitFxRateVnd =
        asset.code === 'USDT'
          ? BigInt(await this.exchangePricingService.getUsdtPriceInVnd())
          : null;
      const feeProfitVndMinor =
        asset.code === 'USDT' && profitFxRateVnd !== null
          ? (withdrawal.feeAmountMinor * profitFxRateVnd) /
            10n ** BigInt(asset.assetPrecision)
          : withdrawal.feeAmountMinor;

      await this.ledgerService.settlePendingAndTotal(
        tx,
        lockedWallet.id,
        withdrawal.totalDebitMinor,
        'withdrawal_request',
        withdrawal.id,
        reviewNote,
        undefined,
        lockedWallet,
      );

      await tx
        .update(withdrawalRequests)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: adminUserId,
          feeProfitVndMinor,
          profitFxRateVnd,
          reviewNote: reviewNote ?? null,
        })
        .where(eq(withdrawalRequests.id, withdrawalId));

      await this.userNotificationsService.createWithdrawalApproved(tx, {
        assetCode: asset.code,
        totalDebit: fromMinorUnits(
          withdrawal.totalDebitMinor,
          asset.assetPrecision,
        ),
        userId: withdrawal.userId,
        withdrawalRequestId: withdrawal.id,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'withdrawal.approved',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        metadata: null,
      });
    });

    return { success: true };
  }

  async reject(adminUserId: string, withdrawalId: string, reviewNote?: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [withdrawal] = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId))
        .for('update');

      if (!withdrawal) {
        throw new NotFoundException({
          code: 'withdrawal_not_found',
          message: 'Không tìm thấy yêu cầu rút tiền.',
        });
      }

      if (withdrawal.status !== 'pending') {
        throw new ConflictException({
          code: 'withdrawal_already_reviewed',
          message: 'Yêu cầu rút tiền này đã được xử lý trước đó.',
        });
      }

      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        withdrawal.userId,
        withdrawal.assetId,
      );
      const asset = await this.assetsService.findById(withdrawal.assetId);

      if (!asset) {
        throw new NotFoundException({
          code: 'asset_not_found',
          message: 'Không tìm thấy tài sản.',
        });
      }

      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

      await this.ledgerService.releasePendingToAvailable(
        tx,
        lockedWallet.id,
        withdrawal.totalDebitMinor,
        'withdrawal_request',
        withdrawal.id,
        reviewNote,
        undefined,
        lockedWallet,
      );

      await tx
        .update(withdrawalRequests)
        .set({
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: adminUserId,
          reviewNote: reviewNote ?? null,
        })
        .where(
          and(
            eq(withdrawalRequests.id, withdrawalId),
            eq(withdrawalRequests.status, 'pending'),
          ),
        );

      await this.userNotificationsService.createWithdrawalRejected(tx, {
        assetCode: asset.code,
        totalDebit: fromMinorUnits(
          withdrawal.totalDebitMinor,
          asset.assetPrecision,
        ),
        userId: withdrawal.userId,
        withdrawalRequestId: withdrawal.id,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'withdrawal.rejected',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        metadata: null,
      });
    });

    return { success: true };
  }

  async restorePending(adminUserId: string, withdrawalId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [withdrawal] = await tx
        .select()
        .from(withdrawalRequests)
        .where(eq(withdrawalRequests.id, withdrawalId))
        .for('update');

      if (!withdrawal) {
        throw new NotFoundException({
          code: 'withdrawal_not_found',
          message: 'Không tìm thấy yêu cầu rút tiền.',
        });
      }

      if (withdrawal.status === 'pending') {
        throw new ConflictException({
          code: 'withdrawal_restore_invalid_state',
          message: 'Yêu cầu rút tiền này đang ở trạng thái chờ duyệt.',
        });
      }

      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        withdrawal.userId,
        withdrawal.assetId,
      );
      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

      if (withdrawal.status === 'rejected') {
        await this.ledgerService.reserveAvailableToPending(
          tx,
          lockedWallet.id,
          withdrawal.totalDebitMinor,
          'withdrawal_request',
          withdrawal.id,
          'Khôi phục chờ duyệt',
          undefined,
          lockedWallet,
        );
      }

      if (withdrawal.status === 'approved') {
        await this.ledgerService.restoreSettledToPendingAndTotal(
          tx,
          lockedWallet.id,
          withdrawal.totalDebitMinor,
          'withdrawal_request',
          withdrawal.id,
          'Khôi phục chờ duyệt',
          undefined,
          lockedWallet,
        );
      }

      await tx
        .update(withdrawalRequests)
        .set({
          approvedAt: null,
          approvedBy: null,
          feeProfitVndMinor: 0n,
          profitFxRateVnd: null,
          rejectedAt: null,
          rejectedBy: null,
          reviewNote: null,
          status: 'pending',
        })
        .where(eq(withdrawalRequests.id, withdrawalId));

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'withdrawal.restored_to_pending',
        entityType: 'withdrawal_request',
        entityId: withdrawalId,
        metadata: {
          previousStatus: withdrawal.status,
        },
      });
    });

    return { success: true };
  }
}
