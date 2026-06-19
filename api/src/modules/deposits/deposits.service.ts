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
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { matchesAdminUserSearch } from '../users/admin-user-search';
import { WalletsService } from '../wallets/wallets.service';
import { DatabaseService } from '../../platform/database/database.service';
import type { VietnamDateRangeQuery } from '../../platform/time/vietnam-date-range-query';
import {
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
} from '../../platform/money/amounts';
import {
  assets,
    bankAccounts,
    depositReservations,
    depositRequests,
    users,
  } from '../../platform/database/schema';
import { CreateDepositDto } from './dto/create-deposit.dto';

type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'all';
const USER_CANCELLED_DEPOSIT_NOTE = 'Hủy bởi người dùng';

@Injectable()
export class DepositsService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly databaseService: DatabaseService,
    private readonly idempotencyService: IdempotencyService,
    private readonly ledgerService: LedgerService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly walletsService: WalletsService,
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  async create(userId: string, dto: CreateDepositDto, idempotencyKey: string) {
    if (dto.assetCode === 'VND' && dto.method === 'bank_transfer') {
      throw new BadRequestException({
        code: 'deposit_vnd_requires_reservation',
        message: 'Nạp VND qua chuyển khoản phải đi qua bước giữ chỗ trước.',
      });
    }

    if (dto.assetCode === 'USDT') {
      throw new BadRequestException({
        code: 'deposit_usdt_disabled',
        message: 'Nạp USDT hiện đã tắt. Vui lòng chỉ sử dụng luồng nạp VNĐ.',
      });
    }

    await this.idempotencyService.claim(
      userId,
      'deposit:create',
      idempotencyKey,
    );

    const asset = await this.assetsService.findByCode(dto.assetCode);
    if (!asset) {
      throw new NotFoundException({
        code: 'asset_not_found',
        message: 'Không tìm thấy tài sản.',
      });
    }

    const amountMinor = parsePositiveAmountToMinorUnits(
      dto.amount,
      asset.assetPrecision,
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

    const depositId = randomUUID();
    const createdAt = new Date();
    const selectedBankAccount =
      dto.assetCode === 'VND' && dto.method === 'bank_transfer'
        ? await this.bankAccountsService.pickForDeposit(amountMinor)
        : null;

    await this.databaseService.db.transaction(async (tx) => {
      await tx.insert(depositRequests).values({
        id: depositId,
        userId,
        assetId: asset.id,
        amountMinor,
        bankAccountId: selectedBankAccount?.id ?? null,
        createdAt,
        method: dto.method,
        destinationRef: dto.destinationRef ?? null,
        externalReference: dto.externalReference ?? null,
        proofUrl: dto.proofUrl ?? null,
        note: dto.note ?? null,
      });

      await this.notificationOutboxService.enqueueDepositPendingCreated(tx, {
        amount: fromMinorUnits(amountMinor, asset.assetPrecision),
        assetCode: asset.code,
        createdAt,
        depositRequestId: depositId,
        destinationRef: dto.destinationRef ?? null,
        externalReference: dto.externalReference ?? null,
        method: dto.method,
        note: dto.note ?? null,
        proofUrl: dto.proofUrl ?? null,
        selectedBankAccount: selectedBankAccount
          ? this.bankAccountsService.toSelectedBankAccountPayload(
              selectedBankAccount,
            )
          : null,
        userEmail: user.email,
        userId,
      });
    });

    await this.auditService.log({
      actorUserId: userId,
      action: 'deposit.created',
      entityType: 'deposit_request',
      entityId: depositId,
      metadata: { assetCode: asset.code, amount: dto.amount },
    });

    return {
      assetCode: asset.code,
      amount: fromMinorUnits(amountMinor, asset.assetPrecision),
      id: depositId,
      selectedBankAccount: selectedBankAccount
        ? this.bankAccountsService.toSelectedBankAccountPayload(
            selectedBankAccount,
          )
        : null,
      status: 'pending',
    };
  }

  async listForUser(userId: string) {
    const rows = await this.databaseService.db
      .select({
        id: depositRequests.id,
        amountMinor: depositRequests.amountMinor,
        assetCode: assets.code,
        precision: assets.assetPrecision,
        method: depositRequests.method,
        status: depositRequests.status,
        bankAccountId: depositRequests.bankAccountId,
        note: depositRequests.note,
        reviewNote: depositRequests.reviewNote,
        destinationRef: depositRequests.destinationRef,
        externalReference: depositRequests.externalReference,
        proofUrl: depositRequests.proofUrl,
        bankAccountName: bankAccounts.accountName,
        bankAccountNumber: bankAccounts.accountNumber,
        bankCode: bankAccounts.bankCode,
        bankName: bankAccounts.bankName,
        bankPriority: bankAccounts.priority,
        approvedAt: depositRequests.approvedAt,
        cancelledAt: depositRequests.cancelledAt,
        createdAt: depositRequests.createdAt,
        rejectedAt: depositRequests.rejectedAt,
      })
      .from(depositRequests)
      .innerJoin(assets, eq(depositRequests.assetId, assets.id))
      .leftJoin(
        bankAccounts,
        eq(depositRequests.bankAccountId, bankAccounts.id),
      )
      .where(eq(depositRequests.userId, userId))
      .orderBy(desc(depositRequests.createdAt));

    return rows.map((row) => ({
      id: row.id,
      amount: fromMinorUnits(row.amountMinor, row.precision),
      assetCode: row.assetCode,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      destinationRef: row.destinationRef,
      externalReference: row.externalReference,
      method: row.method,
      note: row.note,
      proofUrl: row.proofUrl,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      reviewNote: row.reviewNote,
      selectedBankAccount: row.bankAccountId
        ? {
            accountName: row.bankAccountName,
            accountNumber: row.bankAccountNumber,
            bankCode: row.bankCode,
            bankName: row.bankName,
            id: row.bankAccountId,
            priority: row.bankPriority,
          }
        : null,
      status: row.status,
    }));
  }

  async listForAdmin(
    status: ReviewStatus,
    dateRange?: VietnamDateRangeQuery,
    search?: string,
  ) {
    const query = this.databaseService.db
      .select({
        id: depositRequests.id,
        userId: depositRequests.userId,
        userEmail: users.email,
        userPhone: users.phone,
        amountMinor: depositRequests.amountMinor,
        assetCode: assets.code,
        precision: assets.assetPrecision,
        method: depositRequests.method,
        status: depositRequests.status,
        note: depositRequests.note,
        reviewNote: depositRequests.reviewNote,
        bankAccountId: depositRequests.bankAccountId,
        destinationRef: depositRequests.destinationRef,
        externalReference: depositRequests.externalReference,
        proofUrl: depositRequests.proofUrl,
        bankAccountName: bankAccounts.accountName,
        bankAccountNumber: bankAccounts.accountNumber,
        bankCode: bankAccounts.bankCode,
        bankName: bankAccounts.bankName,
        bankPriority: bankAccounts.priority,
        createdAt: depositRequests.createdAt,
        approvedAt: depositRequests.approvedAt,
        rejectedAt: depositRequests.rejectedAt,
      })
      .from(depositRequests)
      .innerJoin(assets, eq(depositRequests.assetId, assets.id))
      .innerJoin(users, eq(depositRequests.userId, users.id))
      .leftJoin(
        bankAccounts,
        eq(depositRequests.bankAccountId, bankAccounts.id),
      )
      .orderBy(desc(depositRequests.createdAt));

    const filters: SQL[] = [];
    filters.push(ne(depositRequests.status, 'cancelled'));

    if (status !== 'all') {
      filters.push(eq(depositRequests.status, status));
    }

    if (dateRange) {
      filters.push(gte(depositRequests.createdAt, dateRange.start));
      filters.push(lt(depositRequests.createdAt, dateRange.endExclusive));
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
      method: row.method,
      status: row.status,
      note: row.note,
      reviewNote: row.reviewNote,
      bankAccountId: row.bankAccountId,
      destinationRef: row.destinationRef,
      externalReference: row.externalReference,
      proofUrl: row.proofUrl,
      selectedBankAccount: row.bankAccountId
        ? {
            accountName: row.bankAccountName,
            accountNumber: row.bankAccountNumber,
            bankCode: row.bankCode,
            bankName: row.bankName,
            id: row.bankAccountId,
            priority: row.bankPriority,
          }
        : null,
      createdAt: row.createdAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
    }));
  }

  async cancel(userId: string, depositId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [deposit] = await tx
        .select()
        .from(depositRequests)
        .where(eq(depositRequests.id, depositId))
        .limit(1)
        .for('update');

      if (!deposit || deposit.userId !== userId) {
        throw new NotFoundException({
          code: 'deposit_not_found',
          message: 'Không tìm thấy yêu cầu nạp tiền.',
        });
      }

      if (deposit.status !== 'pending') {
        throw new ConflictException({
          code: 'deposit_cancel_invalid_state',
          message: 'Yêu cầu nạp tiền này hiện không còn ở trạng thái có thể hủy.',
        });
      }

      const [reservation] = await tx
        .select()
        .from(depositReservations)
        .where(eq(depositReservations.depositRequestId, deposit.id))
        .limit(1)
        .for('update');

      await tx
        .update(depositRequests)
        .set({
          cancelledAt: new Date(),
          reviewNote: USER_CANCELLED_DEPOSIT_NOTE,
          status: 'cancelled',
        })
        .where(eq(depositRequests.id, deposit.id));

      if (reservation) {
        await tx
          .update(depositReservations)
          .set({
            status: 'cancelled',
          })
          .where(eq(depositReservations.id, reservation.id));
      }

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'deposit.cancelled_by_user',
        entityType: 'deposit_request',
        entityId: deposit.id,
        metadata: {
          reservationId: reservation?.id ?? null,
        },
      });
    });

    return { success: true };
  }

  async approve(adminUserId: string, depositId: string, reviewNote?: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [deposit] = await tx
        .select()
        .from(depositRequests)
        .where(eq(depositRequests.id, depositId))
        .for('update');

      if (!deposit) {
        throw new NotFoundException({
          code: 'deposit_not_found',
          message: 'Không tìm thấy yêu cầu nạp tiền.',
        });
      }

      if (deposit.status !== 'pending') {
        throw new ConflictException({
          code: 'deposit_already_reviewed',
          message: 'Yêu cầu nạp tiền này đã được xử lý trước đó.',
        });
      }

      const wallet = await this.walletsService.getWalletByUserAndAssetId(
        deposit.userId,
        deposit.assetId,
      );
      const asset = await this.assetsService.findById(deposit.assetId);

      if (!asset) {
        throw new NotFoundException({
          code: 'asset_not_found',
          message: 'Không tìm thấy tài sản.',
        });
      }

      const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

      await this.ledgerService.creditAvailableAndTotal(
        tx,
        lockedWallet.id,
        deposit.amountMinor,
        'deposit_request',
        deposit.id,
        reviewNote,
        undefined,
        lockedWallet,
      );

      if (deposit.bankAccountId) {
        await this.bankAccountsService.incrementUsageOnApproval(
          tx,
          deposit.bankAccountId,
          deposit.amountMinor,
        );
      }

      await tx
        .update(depositRequests)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: adminUserId,
          reviewNote: reviewNote ?? null,
        })
        .where(eq(depositRequests.id, depositId));

      await tx
        .update(depositReservations)
        .set({
          status: 'approved',
        })
        .where(eq(depositReservations.depositRequestId, depositId));

      await this.userNotificationsService.createDepositApproved(tx, {
        amount: fromMinorUnits(deposit.amountMinor, asset.assetPrecision),
        assetCode: asset.code,
        depositRequestId: deposit.id,
        userId: deposit.userId,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'deposit.approved',
        entityType: 'deposit_request',
        entityId: depositId,
        metadata: null,
      });
    });

    return { success: true };
  }

  async reject(adminUserId: string, depositId: string, reviewNote?: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [deposit] = await tx
        .select()
        .from(depositRequests)
        .where(eq(depositRequests.id, depositId))
        .for('update');

      if (!deposit) {
        throw new NotFoundException({
          code: 'deposit_not_found',
          message: 'Không tìm thấy yêu cầu nạp tiền.',
        });
      }

      if (deposit.status !== 'pending') {
        throw new ConflictException({
          code: 'deposit_already_reviewed',
          message: 'Yêu cầu nạp tiền này đã được xử lý trước đó.',
        });
      }

      const asset = await this.assetsService.findById(deposit.assetId);

      if (!asset) {
        throw new NotFoundException({
          code: 'asset_not_found',
          message: 'Không tìm thấy tài sản.',
        });
      }

      await tx
        .update(depositRequests)
        .set({
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: adminUserId,
          reviewNote: reviewNote ?? null,
        })
        .where(
          and(
            eq(depositRequests.id, depositId),
            eq(depositRequests.status, 'pending'),
          ),
        );

      await tx
        .update(depositReservations)
        .set({
          status: 'rejected',
        })
        .where(eq(depositReservations.depositRequestId, depositId));

      await this.userNotificationsService.createDepositRejected(tx, {
        amount: fromMinorUnits(deposit.amountMinor, asset.assetPrecision),
        assetCode: asset.code,
        depositRequestId: deposit.id,
        reviewNote,
        userId: deposit.userId,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'deposit.rejected',
        entityType: 'deposit_request',
        entityId: depositId,
        metadata: null,
      });
    });

    return { success: true };
  }

  async restorePending(adminUserId: string, depositId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [deposit] = await tx
        .select()
        .from(depositRequests)
        .where(eq(depositRequests.id, depositId))
        .for('update');

      if (!deposit) {
        throw new NotFoundException({
          code: 'deposit_not_found',
          message: 'Không tìm thấy yêu cầu nạp tiền.',
        });
      }

      if (deposit.status === 'pending') {
        throw new ConflictException({
          code: 'deposit_restore_invalid_state',
          message: 'Yêu cầu nạp tiền này đang ở trạng thái chờ duyệt.',
        });
      }

      if (deposit.status === 'approved') {
        const wallet = await this.walletsService.getWalletByUserAndAssetId(
          deposit.userId,
          deposit.assetId,
        );
        const lockedWallet = await this.ledgerService.lockWallet(tx, wallet.id);

        await this.ledgerService.debitAvailableAndTotal(
          tx,
          lockedWallet.id,
          deposit.amountMinor,
          'deposit_request',
          deposit.id,
          'Khôi phục chờ duyệt',
          undefined,
          lockedWallet,
        );

        if (deposit.bankAccountId) {
          await this.bankAccountsService.decrementUsageOnRestore(
            tx,
            deposit.bankAccountId,
            deposit.amountMinor,
          );
        }
      }

      await tx
        .update(depositRequests)
        .set({
          approvedAt: null,
          approvedBy: null,
          rejectedAt: null,
          rejectedBy: null,
          reviewNote: null,
          status: 'pending',
        })
        .where(eq(depositRequests.id, depositId));

      await tx
        .update(depositReservations)
        .set({
          status: 'pending_review',
        })
        .where(eq(depositReservations.depositRequestId, depositId));

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'deposit.restored_to_pending',
        entityType: 'deposit_request',
        entityId: depositId,
        metadata: {
          previousStatus: deposit.status,
        },
      });
    });

    return { success: true };
  }
}
