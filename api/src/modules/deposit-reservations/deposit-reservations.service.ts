import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service';
import { countReservationAsReservedUnconfirmed } from '../bank-accounts/reservation-liveness';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { SettingsService } from '../settings/settings.service';
import { DatabaseService } from '../../platform/database/database.service';
import type { AppTransaction } from '../../platform/database/database.types';
import {
  assets,
  depositRequests,
  depositReservations,
  users,
} from '../../platform/database/schema';
import {
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
} from '../../platform/money/amounts';
import { CreateDepositReservationDto } from './dto/create-deposit-reservation.dto';
import { createDepositTransferContent } from './transfer-content';

const MAX_PENDING_REVIEW_RESERVATIONS = 10;
const USER_CANCELLED_DEPOSIT_REVIEW_NOTE = 'Hủy bởi người dùng';

@Injectable()
export class DepositReservationsService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly bankAccountsService: BankAccountsService,
    private readonly databaseService: DatabaseService,
    private readonly notificationOutboxService: NotificationOutboxService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(
    user: { email: string; id: string },
    dto: CreateDepositReservationDto,
  ) {
    if (!(dto.assetCode === 'VND' && dto.method === 'bank_transfer')) {
      throw new BadRequestException({
        code: 'deposit_vnd_requires_reservation',
        message: 'Nạp VND qua chuyển khoản phải đi qua bước giữ chỗ trước.',
      });
    }

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

    return this.databaseService.db.transaction(async (tx) => {
      await this.bankAccountsService.expireStaleReservations(tx);
      await this.assertCanCreateReservation(tx, user.id);

      const ttlMinutes =
        await this.settingsService.getDepositReservationTtlMinutes(tx);
      const selectedBankAccount = await this.bankAccountsService.pickForDeposit(
        amountMinor,
        tx,
      );
      const reservationId = randomUUID();
      const transferContent = createDepositTransferContent();
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

      await tx.insert(depositReservations).values({
        id: reservationId,
        userId: user.id,
        assetId: asset.id,
        amountMinor,
        bankAccountId: selectedBankAccount.id,
        expiresAt,
        method: dto.method,
        transferContent,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: user.id,
        action: 'deposit-reservation.created',
        entityType: 'deposit_reservation',
        entityId: reservationId,
        metadata: {
          amount: dto.amount,
          assetCode: asset.code,
          bankAccountId: selectedBankAccount.id,
        },
      });

      return {
        amount: fromMinorUnits(amountMinor, asset.assetPrecision),
        assetCode: asset.code,
        expiresAt: expiresAt.toISOString(),
        reservationId,
        selectedBankAccount:
          this.bankAccountsService.toSelectedBankAccountPayload(
            selectedBankAccount,
          ),
        status: 'active',
        transferContent,
      };
    });
  }

  async list(userId: string) {
    return this.databaseService.db.transaction(async (tx) => {
      await this.bankAccountsService.expireStaleReservations(tx);
      const reservations = [...(await this.getLiveReservations(tx, userId))].sort(
        (left, right) => {
          if (left.status === 'active' && right.status !== 'active') {
            return -1;
          }

          if (left.status !== 'active' && right.status === 'active') {
            return 1;
          }

          return right.createdAt.getTime() - left.createdAt.getTime();
        },
      );

      return Promise.all(
        reservations.map(async (reservation) => {
          const selectedBankAccount = await this.bankAccountsService.getById(
            reservation.bankAccountId,
            tx,
          );

          return {
            amount: fromMinorUnits(reservation.amountMinor, reservation.precision),
            assetCode: reservation.assetCode,
            confirmedAt: reservation.confirmedAt?.toISOString() ?? null,
            depositRequestId: reservation.depositRequestId ?? null,
            depositStatus: reservation.depositStatus ?? null,
            expiresAt: reservation.expiresAt.toISOString(),
            reservationId: reservation.reservationId,
            selectedBankAccount:
              this.bankAccountsService.toSelectedBankAccountPayload(
                selectedBankAccount,
              ),
            status: reservation.status,
            transferContent: reservation.transferContent,
          };
        }),
      );
    });
  }

  async confirm(userId: string, reservationId: string) {
    return this.databaseService.db.transaction(async (tx) => {
      await this.bankAccountsService.expireStaleReservations(tx);

      const [reservation] = await tx
        .select()
        .from(depositReservations)
        .where(eq(depositReservations.id, reservationId))
        .limit(1)
        .for('update');

      if (!reservation || reservation.userId !== userId) {
        throw new NotFoundException({
          code: 'deposit_reservation_not_found',
          message: 'Không tìm thấy giữ chỗ nạp tiền.',
        });
      }

      if (reservation.status !== 'active') {
        throw new ConflictException({
          code: 'deposit_reservation_invalid_state',
          message:
            'Giữ chỗ nạp tiền hiện không còn ở trạng thái có thể xác nhận.',
        });
      }

      if (reservation.expiresAt.getTime() <= Date.now()) {
        await tx
          .update(depositReservations)
          .set({
            status: 'expired',
          })
          .where(eq(depositReservations.id, reservation.id));

        throw new ConflictException({
          code: 'deposit_reservation_expired',
          message: 'Giữ chỗ nạp tiền đã hết hạn.',
        });
      }

      await this.assertPendingReviewLimitNotReached(tx, userId);

      const [asset] = await tx
        .select({
          assetCode: assets.code,
          precision: assets.assetPrecision,
        })
        .from(assets)
        .where(eq(assets.id, reservation.assetId))
        .limit(1);

      if (!asset) {
        throw new NotFoundException({
          code: 'asset_not_found',
          message: 'Không tìm thấy tài sản.',
        });
      }

      const [user] = await tx
        .select({
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, reservation.userId))
        .limit(1);

      if (!user) {
        throw new NotFoundException({
          code: 'user_not_found',
          message: 'Không tìm thấy người dùng.',
        });
      }

      const selectedBankAccount = await this.bankAccountsService.getById(
        reservation.bankAccountId,
        tx,
      );
      const depositId = randomUUID();
      const createdAt = new Date();

      await tx.insert(depositRequests).values({
        id: depositId,
        userId: reservation.userId,
        assetId: reservation.assetId,
        amountMinor: reservation.amountMinor,
        bankAccountId: reservation.bankAccountId,
        createdAt,
        destinationRef: reservation.transferContent,
        method: reservation.method,
      });

      await this.notificationOutboxService.enqueueDepositPendingCreated(tx, {
        amount: fromMinorUnits(reservation.amountMinor, asset.precision),
        assetCode: asset.assetCode,
        createdAt,
        depositRequestId: depositId,
        destinationRef: reservation.transferContent,
        externalReference: null,
        method: reservation.method,
        note: null,
        proofUrl: null,
        selectedBankAccount:
          this.bankAccountsService.toSelectedBankAccountPayload(
            selectedBankAccount,
          ),
        userEmail: user.email,
        userId: reservation.userId,
      });

      await tx
        .update(depositReservations)
        .set({
          confirmedAt: new Date(),
          depositRequestId: depositId,
          status: 'pending_review',
        })
        .where(eq(depositReservations.id, reservation.id));

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'deposit-reservation.confirmed',
        entityType: 'deposit_reservation',
        entityId: reservation.id,
        metadata: {
          depositRequestId: depositId,
        },
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'deposit.created',
        entityType: 'deposit_request',
        entityId: depositId,
        metadata: {
          assetCode: asset.assetCode,
          amount: fromMinorUnits(reservation.amountMinor, asset.precision),
          reservationId: reservation.id,
        },
      });

      return {
        amount: fromMinorUnits(reservation.amountMinor, asset.precision),
        assetCode: asset.assetCode,
        id: depositId,
        selectedBankAccount:
          this.bankAccountsService.toSelectedBankAccountPayload(
            selectedBankAccount,
          ),
        status: 'pending',
      };
    });
  }

  async getCurrent(userId: string) {
    return this.databaseService.db.transaction(async (tx) => {
      await this.bankAccountsService.expireStaleReservations(tx);
      const rows = await this.getLiveReservations(tx, userId);

      const current =
        rows.find((row) =>
          countReservationAsReservedUnconfirmed({
            expiresAt: row.expiresAt,
            status: row.status,
          }),
        ) ?? rows.find((row) => row.status === 'pending_review');

      if (!current) {
        return null;
      }

      const selectedBankAccount = await this.bankAccountsService.getById(
        current.bankAccountId,
        tx,
      );

      return {
        amount: fromMinorUnits(current.amountMinor, current.precision),
        assetCode: current.assetCode,
        confirmedAt: current.confirmedAt?.toISOString() ?? null,
        depositRequestId: current.depositRequestId ?? null,
        depositStatus: current.depositStatus ?? null,
        expiresAt: current.expiresAt.toISOString(),
        reservationId: current.reservationId,
        selectedBankAccount:
          this.bankAccountsService.toSelectedBankAccountPayload(
            selectedBankAccount,
          ),
        status: current.status,
        transferContent: current.transferContent,
      };
    });
  }

  async cancel(userId: string, reservationId: string) {
    return this.databaseService.db.transaction(async (tx) => {
      await this.bankAccountsService.expireStaleReservations(tx);

      const [reservation] = await tx
        .select()
        .from(depositReservations)
        .where(eq(depositReservations.id, reservationId))
        .limit(1)
        .for('update');

      if (!reservation || reservation.userId !== userId) {
        throw new NotFoundException({
          code: 'deposit_reservation_not_found',
          message: 'Không tìm thấy giữ chỗ nạp tiền.',
        });
      }

      if (reservation.status === 'active') {
        await tx
          .update(depositReservations)
          .set({
            status: 'cancelled',
          })
          .where(eq(depositReservations.id, reservation.id));
      } else if (
        reservation.status === 'pending_review'
        && reservation.depositRequestId
      ) {
        const [deposit] = await tx
          .select()
          .from(depositRequests)
          .where(eq(depositRequests.id, reservation.depositRequestId))
          .limit(1)
          .for('update');

        if (!deposit || deposit.status !== 'pending') {
          throw new ConflictException({
            code: 'deposit_reservation_invalid_state',
            message: 'Bill nạp tiền này hiện không còn ở trạng thái có thể hủy.',
          });
        }

        await tx
          .update(depositRequests)
          .set({
            rejectedAt: new Date(),
            rejectedBy: userId,
            reviewNote: USER_CANCELLED_DEPOSIT_REVIEW_NOTE,
            status: 'rejected',
          })
          .where(eq(depositRequests.id, deposit.id));

        await tx
          .update(depositReservations)
          .set({
            status: 'cancelled',
          })
          .where(eq(depositReservations.id, reservation.id));

        await this.auditService.logWithTransaction(tx, {
          actorUserId: userId,
          action: 'deposit.cancelled_by_user',
          entityType: 'deposit_request',
          entityId: deposit.id,
          metadata: {
            reservationId: reservation.id,
          },
        });
      } else {
        throw new ConflictException({
          code: 'deposit_reservation_invalid_state',
          message: 'Chỉ có thể huỷ giữ chỗ hoặc bill nạp tiền chưa được duyệt.',
        });
      }

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'deposit-reservation.cancelled',
        entityType: 'deposit_reservation',
        entityId: reservation.id,
        metadata: null,
      });

      return { success: true };
    });
  }

  private async getLiveReservations(tx: AppTransaction, userId: string) {
    return tx
      .select({
        amountMinor: depositReservations.amountMinor,
        assetCode: assets.code,
        bankAccountId: depositReservations.bankAccountId,
        confirmedAt: depositReservations.confirmedAt,
        createdAt: depositReservations.createdAt,
        depositRequestId: depositReservations.depositRequestId,
        depositStatus: depositRequests.status,
        expiresAt: depositReservations.expiresAt,
        precision: assets.assetPrecision,
        reservationId: depositReservations.id,
        status: depositReservations.status,
        transferContent: depositReservations.transferContent,
      })
      .from(depositReservations)
      .innerJoin(assets, eq(depositReservations.assetId, assets.id))
      .leftJoin(
        depositRequests,
        eq(depositReservations.depositRequestId, depositRequests.id),
      )
      .where(
        and(
          eq(depositReservations.userId, userId),
          inArray(depositReservations.status, ['active', 'pending_review']),
        ),
      )
      .orderBy(desc(depositReservations.createdAt));
  }

  private async assertCanCreateReservation(tx: AppTransaction, userId: string) {
    const liveReservations = await tx
      .select({
        expiresAt: depositReservations.expiresAt,
        status: depositReservations.status,
      })
      .from(depositReservations)
      .where(
        and(
          eq(depositReservations.userId, userId),
          inArray(depositReservations.status, ['active', 'pending_review']),
        ),
      )
      .orderBy(desc(depositReservations.createdAt))
      .for('update');

    const hasActiveReservation = liveReservations.some((reservation) =>
      countReservationAsReservedUnconfirmed({
        expiresAt: reservation.expiresAt,
        status: reservation.status,
      }),
    );

    if (hasActiveReservation) {
      throw new ConflictException({
        code: 'deposit_reservation_active_exists',
        message:
          'Bạn đang có một giữ chỗ nạp VND còn hiệu lực. Vui lòng hoàn tất hoặc huỷ giữ chỗ hiện tại.',
      });
    }

    const pendingReviewCount = liveReservations.filter(
      (reservation) => reservation.status === 'pending_review',
    ).length;

    if (pendingReviewCount >= MAX_PENDING_REVIEW_RESERVATIONS) {
      throw new ConflictException({
        code: 'deposit_reservation_pending_review_limit_reached',
        message:
          'Bạn đã có 10 bill nạp tiền đang chờ admin duyệt. Vui lòng chờ xử lý hoặc hủy bớt bill trước khi tạo bill mới.',
      });
    }
  }

  private async assertPendingReviewLimitNotReached(
    tx: AppTransaction,
    userId: string,
  ) {
    const pendingReviewReservations = await tx
      .select({
        id: depositReservations.id,
      })
      .from(depositReservations)
      .where(
        and(
          eq(depositReservations.userId, userId),
          eq(depositReservations.status, 'pending_review'),
        ),
      )
      .for('update');

    if (pendingReviewReservations.length >= MAX_PENDING_REVIEW_RESERVATIONS) {
      throw new ConflictException({
        code: 'deposit_reservation_pending_review_limit_reached',
        message:
          'Bạn đã có 10 bill nạp tiền đang chờ admin duyệt. Vui lòng chờ xử lý hoặc hủy bớt bill trước khi tạo bill mới.',
      });
    }
  }
}
