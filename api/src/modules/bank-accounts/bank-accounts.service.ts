import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, lte, ne } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import {
  countReservationAsLive,
} from './reservation-liveness';
import {
  buildReservationBucketTotals,
  getRemainingBankAccountCapacity,
  pickBankAccountForAmount,
} from './bank-account-capacity';
import { DatabaseService } from '../../platform/database/database.service';
import type { AppTransaction } from '../../platform/database/database.types';
import {
  bankAccounts,
  depositRequests,
  depositReservations,
  settings,
} from '../../platform/database/schema';
import {
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
} from '../../platform/money/amounts';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

const BANK_ACCOUNT_USAGE_DATE_KEY = 'bank_account_usage_date';
const BANK_ACCOUNT_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const BANK_ACCOUNT_PRIORITY_UNIQUE_KEY = 'bank_accounts_priority_unique';
const BANK_ACCOUNT_IDENTITY_UNIQUE_KEY = 'bank_accounts_identity_unique';

type BankAccountRow = typeof bankAccounts.$inferSelect;

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly auditService: AuditService,
    private readonly databaseService: DatabaseService,
  ) {}

  async listForAdmin() {
    return this.databaseService.db.transaction(async (tx) => {
      await this.ensureUsageDateCurrentInTransaction(tx);
      await this.expireStaleReservations(tx);

      const rows = await tx
        .select()
        .from(bankAccounts)
        .orderBy(asc(bankAccounts.priority), asc(bankAccounts.createdAt));
      const reservationBuckets = await this.getReservationBucketTotals(tx);
      const pendingDepositCounts = await this.getPendingDepositCounts(tx);
      const approvedDepositTotals = await this.getApprovedDepositTotals(tx);

      return rows.map((row) =>
        this.toAdminPayload(
          row,
          reservationBuckets.reservedPendingReview.get(row.id) ?? 0n,
          reservationBuckets.reservedUnconfirmed.get(row.id) ?? 0n,
          reservationBuckets.liveReservationCount.get(row.id) ?? 0,
          pendingDepositCounts.get(row.id) ?? 0,
          approvedDepositTotals.get(row.id) ?? 0n,
        ),
      );
    });
  }

  async create(adminUserId: string, dto: CreateBankAccountDto) {
    const normalized = this.normalizeInput(dto);
    const id = randomUUID();

    try {
      return await this.databaseService.db.transaction(async (tx) => {
        await this.ensureUsageDateCurrentInTransaction(tx);
        await this.assertUnique(
          normalized.priority,
          normalized.bankCode,
          normalized.accountNumber,
          undefined,
          tx,
        );

        await tx.insert(bankAccounts).values({
          id,
          accountName: normalized.accountName,
          accountNumber: normalized.accountNumber,
          bankCode: normalized.bankCode,
          bankName: normalized.bankName,
          dailyLimitMinor: normalized.dailyLimitMinor,
          isActive: normalized.isActive,
          priority: normalized.priority,
          usedTodayMinor: 0n,
        });

        await this.auditService.logWithTransaction(tx, {
          actorUserId: adminUserId,
          action: 'bank-account.created',
          entityType: 'bank_account',
          entityId: id,
          metadata: {
            accountNumber: normalized.accountNumber,
            bankCode: normalized.bankCode,
            priority: normalized.priority,
          },
        });

        const [created] = await tx
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, id));

        if (!created) {
          throw new NotFoundException({
            code: 'bank_account_not_found',
            message: 'Không tìm thấy tài khoản ngân hàng vừa tạo.',
          });
        }

        return this.toAdminPayload(created);
      });
    } catch (error) {
      this.rethrowBankAccountConstraintError(error);
    }
  }

  async update(adminUserId: string, id: string, dto: UpdateBankAccountDto) {
    const normalized = this.normalizeInput(dto);
    try {
      return await this.databaseService.db.transaction(async (tx) => {
        await this.ensureUsageDateCurrentInTransaction(tx);
        await this.expireStaleReservationsInTransaction(tx);

        const existing = await this.getLockedById(tx, id);

        await this.assertUnique(
          normalized.priority,
          normalized.bankCode,
          normalized.accountNumber,
          id,
          tx,
        );

        const committedUsageMinor = await this.getCommittedUsageMinor(tx, id);
        if (normalized.dailyLimitMinor < committedUsageMinor) {
          throw new ConflictException({
            code: 'bank_account_daily_limit_below_committed_usage',
            message:
              'Không thể giảm hạn mức ngày xuống thấp hơn phần đã duyệt hoặc đang được giữ chỗ.',
          });
        }

        await tx
          .update(bankAccounts)
          .set({
            accountName: normalized.accountName,
            accountNumber: normalized.accountNumber,
            bankCode: normalized.bankCode,
            bankName: normalized.bankName,
            dailyLimitMinor: normalized.dailyLimitMinor,
            isActive: normalized.isActive,
            priority: normalized.priority,
          })
          .where(eq(bankAccounts.id, id));

        await this.auditService.logWithTransaction(tx, {
          actorUserId: adminUserId,
          action: 'bank-account.updated',
          entityType: 'bank_account',
          entityId: id,
          metadata: {
            previousDailyLimit: fromMinorUnits(existing.dailyLimitMinor, 0),
            accountNumber: normalized.accountNumber,
            bankCode: normalized.bankCode,
            priority: normalized.priority,
          },
        });

        const [updated] = await tx
          .select()
          .from(bankAccounts)
          .where(eq(bankAccounts.id, id));

        if (!updated) {
          throw new NotFoundException({
            code: 'bank_account_not_found',
            message: 'Không tìm thấy tài khoản ngân hàng vừa cập nhật.',
          });
        }

        return this.toAdminPayload(updated);
      });
    } catch (error) {
      this.rethrowBankAccountConstraintError(error);
    }
  }

  async remove(adminUserId: string, id: string) {
    await this.assertExists(id);
    await this.assertNotInUse(id);

    await this.databaseService.db
      .delete(bankAccounts)
      .where(eq(bankAccounts.id, id));

    await this.auditService.log({
      actorUserId: adminUserId,
      action: 'bank-account.deleted',
      entityType: 'bank_account',
      entityId: id,
      metadata: null,
    });

    return { success: true };
  }

  async resetDailyUsage(adminUserId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      await this.resetUsageInTransaction(tx);

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'bank-account.usage-reset',
        entityType: 'bank_account',
        entityId: 'all',
        metadata: { usageDate: this.getCurrentUsageDate() },
      });
    });

    return { success: true };
  }

  async pickForDeposit(amountMinor: bigint, tx?: AppTransaction) {
    if (tx) {
      return this.pickForDepositInTransaction(tx, amountMinor);
    }

    return this.databaseService.db.transaction((innerTx) =>
      this.pickForDepositInTransaction(innerTx, amountMinor),
    );
  }

  async incrementUsageOnApproval(
    tx: AppTransaction,
    bankAccountId: string,
    amountMinor: bigint,
  ) {
    await this.ensureUsageDateCurrentInTransaction(tx);

    const [account] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bankAccountId))
      .for('update');

    if (!account) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng đã gán.',
      });
    }

    await tx
      .update(bankAccounts)
      .set({
        usedTodayMinor: account.usedTodayMinor + amountMinor,
      })
      .where(eq(bankAccounts.id, bankAccountId));
  }

  async decrementUsageOnRestore(
    tx: AppTransaction,
    bankAccountId: string,
    amountMinor: bigint,
  ) {
    await this.ensureUsageDateCurrentInTransaction(tx);

    const [account] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bankAccountId))
      .for('update');

    if (!account) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng đã gán.',
      });
    }

    await tx
      .update(bankAccounts)
      .set({
        usedTodayMinor:
          account.usedTodayMinor > amountMinor
            ? account.usedTodayMinor - amountMinor
            : 0n,
      })
      .where(eq(bankAccounts.id, bankAccountId));
  }

  toSelectedBankAccountPayload(row: BankAccountRow) {
    return {
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      bankCode: row.bankCode,
      bankName: row.bankName,
      id: row.id,
      priority: row.priority,
    };
  }

  async getById(id: string, tx?: AppTransaction) {
    const executor = tx ?? this.databaseService.db;
    const [row] = await executor
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1);

    if (!row) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng đã gán.',
      });
    }

    return row;
  }

  async expireStaleReservations(tx?: AppTransaction) {
    if (tx) {
      await this.expireStaleReservationsInTransaction(tx);
      return;
    }

    await this.databaseService.db.transaction(async (innerTx) => {
      await this.expireStaleReservationsInTransaction(innerTx);
    });
  }

  private getCurrentUsageDate() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: BANK_ACCOUNT_TIME_ZONE,
    }).format(new Date());
  }

  async ensureUsageDateCurrent() {
    await this.databaseService.db.transaction(async (tx) => {
      await this.ensureUsageDateCurrentInTransaction(tx);
    });
  }

  private async ensureUsageDateCurrentInTransaction(tx: AppTransaction) {
    const today = this.getCurrentUsageDate();

    const [usageDateSetting] = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, BANK_ACCOUNT_USAGE_DATE_KEY))
      .limit(1)
      .for('update');

    if (usageDateSetting?.value === today) {
      return;
    }

    await this.resetUsageInTransaction(tx, today);
  }

  private async resetUsageInTransaction(
    tx: AppTransaction,
    usageDate?: string,
  ) {
    const today = usageDate ?? this.getCurrentUsageDate();

    await tx.update(bankAccounts).set({
      usedTodayMinor: 0n,
    });

    const [existing] = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, BANK_ACCOUNT_USAGE_DATE_KEY))
      .limit(1)
      .for('update');

    if (existing) {
      await tx
        .update(settings)
        .set({ value: today })
        .where(eq(settings.key, BANK_ACCOUNT_USAGE_DATE_KEY));
      return;
    }

    await tx.insert(settings).values({
      key: BANK_ACCOUNT_USAGE_DATE_KEY,
      value: today,
    });
  }

  private async pickForDepositInTransaction(
    tx: AppTransaction,
    amountMinor: bigint,
  ) {
    await this.ensureUsageDateCurrentInTransaction(tx);
    await this.expireStaleReservationsInTransaction(tx);

    const rows = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.isActive, true))
      .orderBy(asc(bankAccounts.priority), asc(bankAccounts.createdAt))
      .for('update');
    const reservationBuckets = await this.getReservationBucketTotals(tx);
    const selected = pickBankAccountForAmount(rows, reservationBuckets, amountMinor);

    if (!selected) {
      throw new ConflictException({
        code: 'bank_account_capacity_exhausted',
        message:
          'Hiện tại chưa có tài khoản ngân hàng phù hợp cho số tiền này.',
      });
    }

    return selected;
  }

  private async expireStaleReservationsInTransaction(tx: AppTransaction) {
    await tx
      .update(depositReservations)
      .set({
        status: 'expired',
      })
      .where(
        and(
          eq(depositReservations.status, 'active'),
          lte(depositReservations.expiresAt, new Date()),
        ),
      );
  }

  private async getReservationBucketTotals(tx: AppTransaction) {
    const rows = await tx
      .select({
        amountMinor: depositReservations.amountMinor,
        bankAccountId: depositReservations.bankAccountId,
        expiresAt: depositReservations.expiresAt,
        status: depositReservations.status,
      })
      .from(depositReservations)
      .where(inArray(depositReservations.status, ['active', 'pending_review']));

    return buildReservationBucketTotals(rows);
  }

  private async getPendingDepositCounts(tx: AppTransaction) {
    const rows = await tx
      .select({
        bankAccountId: depositRequests.bankAccountId,
      })
      .from(depositRequests)
      .where(eq(depositRequests.status, 'pending'));

    const counts = new Map<string, number>();

    for (const row of rows) {
      if (!row.bankAccountId) {
        continue;
      }

      counts.set(row.bankAccountId, (counts.get(row.bankAccountId) ?? 0) + 1);
    }

    return counts;
  }

  private async getApprovedDepositTotals(tx: AppTransaction) {
    const rows = await tx
      .select({
        amountMinor: depositRequests.amountMinor,
        bankAccountId: depositRequests.bankAccountId,
      })
      .from(depositRequests)
      .where(eq(depositRequests.status, 'approved'));

    const totals = new Map<string, bigint>();

    for (const row of rows) {
      if (!row.bankAccountId) {
        continue;
      }

      totals.set(
        row.bankAccountId,
        (totals.get(row.bankAccountId) ?? 0n) + row.amountMinor,
      );
    }

    return totals;
  }

  private normalizeInput(dto: CreateBankAccountDto | UpdateBankAccountDto) {
    const accountName = dto.accountName.trim();
    const accountNumber = dto.accountNumber.trim();
    const bankCode = dto.bankCode.trim();
    const bankName = dto.bankName.trim();

    if (!accountName || !accountNumber || !bankCode || !bankName) {
      throw new BadRequestException({
        code: 'bank_account_invalid_input',
        message: 'Thông tin tài khoản ngân hàng không được để trống.',
      });
    }

    const dailyLimitMinor = parsePositiveAmountToMinorUnits(dto.dailyLimit, 0);
    const priority = Number(dto.priority);

    if (!Number.isInteger(priority) || priority <= 0) {
      throw new BadRequestException({
        code: 'bank_account_invalid_priority',
        message: 'Độ ưu tiên phải là số nguyên dương.',
      });
    }

    return {
      accountName,
      accountNumber,
      bankCode,
      bankName,
      dailyLimitMinor,
      isActive: dto.isActive,
      priority,
    };
  }

  private async assertExists(id: string) {
    const [existing] = await this.databaseService.db
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng.',
      });
    }
  }

  private async getLockedById(tx: AppTransaction, id: string) {
    const [existing] = await tx
      .select()
      .from(bankAccounts)
      .where(eq(bankAccounts.id, id))
      .limit(1)
      .for('update');

    if (!existing) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng.',
      });
    }

    return existing;
  }

  private async assertNotInUse(id: string) {
    const [liveReservation] = await this.databaseService.db
      .select({
        expiresAt: depositReservations.expiresAt,
        id: depositReservations.id,
        status: depositReservations.status,
      })
      .from(depositReservations)
      .where(
        and(
          eq(depositReservations.bankAccountId, id),
          inArray(depositReservations.status, ['active', 'pending_review']),
        ),
      )
      .limit(1);

    if (
      liveReservation &&
      countReservationAsLive({
        expiresAt: liveReservation.expiresAt,
        status: liveReservation.status,
      })
    ) {
      throw new ConflictException({
        code: 'bank_account_in_use',
        message: 'Không thể xoá tài khoản ngân hàng đang còn được sử dụng.',
      });
    }

    const [pendingDeposit] = await this.databaseService.db
      .select({ id: depositRequests.id })
      .from(depositRequests)
      .where(
        and(
          eq(depositRequests.bankAccountId, id),
          eq(depositRequests.status, 'pending'),
        ),
      )
      .limit(1);

    if (pendingDeposit) {
      throw new ConflictException({
        code: 'bank_account_in_use',
        message: 'Không thể xoá tài khoản ngân hàng đang còn được sử dụng.',
      });
    }
  }

  private async assertUnique(
    priority: number,
    bankCode: string,
    accountNumber: string,
    excludeId?: string,
    tx?: AppTransaction,
  ) {
    const executor = tx ?? this.databaseService.db;

    const duplicatePriority = await executor
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        excludeId
          ? and(
              eq(bankAccounts.priority, priority),
              ne(bankAccounts.id, excludeId),
            )
          : eq(bankAccounts.priority, priority),
      )
      .limit(1);

    if (duplicatePriority.length > 0) {
      throw new ConflictException({
        code: 'bank_account_priority_conflict',
        message: 'Độ ưu tiên của tài khoản ngân hàng phải là duy nhất.',
      });
    }

    const duplicateIdentity = await executor
      .select({ id: bankAccounts.id })
      .from(bankAccounts)
      .where(
        excludeId
          ? and(
              eq(bankAccounts.bankCode, bankCode),
              eq(bankAccounts.accountNumber, accountNumber),
              ne(bankAccounts.id, excludeId),
            )
          : and(
              eq(bankAccounts.bankCode, bankCode),
              eq(bankAccounts.accountNumber, accountNumber),
            ),
      )
      .limit(1);

    if (duplicateIdentity.length > 0) {
      throw new ConflictException({
        code: 'bank_account_identity_conflict',
        message: 'Mã ngân hàng và số tài khoản này đã tồn tại.',
      });
    }
  }

  private async getCommittedUsageMinor(
    tx: AppTransaction,
    bankAccountId: string,
  ) {
    const [account] = await tx
      .select({
        usedTodayMinor: bankAccounts.usedTodayMinor,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.id, bankAccountId))
      .limit(1)
      .for('update');

    if (!account) {
      throw new NotFoundException({
        code: 'bank_account_not_found',
        message: 'Không tìm thấy tài khoản ngân hàng.',
      });
    }

    const rows = await tx
      .select({
        amountMinor: depositReservations.amountMinor,
        expiresAt: depositReservations.expiresAt,
        status: depositReservations.status,
      })
      .from(depositReservations)
      .where(
        and(
          eq(depositReservations.bankAccountId, bankAccountId),
          inArray(depositReservations.status, ['active', 'pending_review']),
        ),
      );

    return rows.reduce((sum, row) => {
      if (
        !countReservationAsLive({
          expiresAt: row.expiresAt,
          status: row.status,
        })
      ) {
        return sum;
      }

      return sum + row.amountMinor;
    }, account.usedTodayMinor);
  }

  private rethrowBankAccountConstraintError(error: unknown): never {
    const databaseError =
      typeof error === 'object' && error !== null
        ? (error as { code?: unknown; message?: unknown })
        : null;

    if (databaseError?.code === 'ER_DUP_ENTRY') {
      const message =
        typeof databaseError.message === 'string' ? databaseError.message : '';

      if (message.includes(BANK_ACCOUNT_PRIORITY_UNIQUE_KEY)) {
        throw new ConflictException({
          code: 'bank_account_priority_conflict',
          message: 'Độ ưu tiên của tài khoản ngân hàng phải là duy nhất.',
        });
      }

      if (message.includes(BANK_ACCOUNT_IDENTITY_UNIQUE_KEY)) {
        throw new ConflictException({
          code: 'bank_account_identity_conflict',
          message: 'Mã ngân hàng và số tài khoản này đã tồn tại.',
        });
      }
    }

    throw error;
  }

  private toAdminPayload(
    row: BankAccountRow,
    reservedPendingReviewMinor = 0n,
    reservedUnconfirmedMinor = 0n,
    liveReservationCount = 0,
    pendingDepositCount = 0,
    approvedTotalMinor = 0n,
  ) {
    const remainingMinor = getRemainingBankAccountCapacity(
      row,
      {
        liveReservationCount: new Map(),
        reservedPendingReview: new Map([[row.id, reservedPendingReviewMinor]]),
        reservedUnconfirmed: new Map([[row.id, reservedUnconfirmedMinor]]),
      },
    );

    return {
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      bankCode: row.bankCode,
      bankName: row.bankName,
      approvedTotal: fromMinorUnits(approvedTotalMinor, 0),
      canDelete: liveReservationCount === 0 && pendingDepositCount === 0,
      createdAt: row.createdAt.toISOString(),
      dailyLimit: fromMinorUnits(row.dailyLimitMinor, 0),
      id: row.id,
      isActive: row.isActive,
      liveReservationCount,
      pendingDepositCount,
      priority: row.priority,
      remainingToday: fromMinorUnits(remainingMinor > 0n ? remainingMinor : 0n, 0),
      reservedPendingReview: fromMinorUnits(reservedPendingReviewMinor, 0),
      reservedUnconfirmed: fromMinorUnits(reservedUnconfirmedMinor, 0),
      updatedAt: row.updatedAt.toISOString(),
      usedToday: fromMinorUnits(row.usedTodayMinor, 0),
    };
  }
}
