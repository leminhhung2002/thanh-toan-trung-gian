import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, lt, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { randomUUID } from 'crypto';
import Big from 'big.js';
import { AssetsService } from '../assets/assets.service';
import { AuditService } from '../audit/audit.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { LedgerService } from '../ledger/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { matchesAdminUserSearch } from '../users/admin-user-search';
import { WalletsService } from '../wallets/wallets.service';
import { DatabaseService } from '../../platform/database/database.service';
import {
  calculateFeeMinorUnits,
  fromMinorUnits,
  parsePositiveAmountToMinorUnits,
  toMinorUnits,
} from '../../platform/money/amounts';
import type { VietnamDateRangeQuery } from '../../platform/time/vietnam-date-range-query';
import {
  assets,
  exchangeOrders,
  exchangeQuotes,
  users,
} from '../../platform/database/schema';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ExchangePricingService } from './exchange-pricing.service';

@Injectable()
export class ExchangeService {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
    private readonly exchangePricingService: ExchangePricingService,
    private readonly databaseService: DatabaseService,
    private readonly idempotencyService: IdempotencyService,
    private readonly ledgerService: LedgerService,
    private readonly settingsService: SettingsService,
    private readonly walletsService: WalletsService,
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  async createQuote(userId: string, dto: CreateQuoteDto) {
    this.assertSupportedDirection(dto.fromAssetCode, dto.toAssetCode);

    const fromAsset = await this.assetsService.findByCode(dto.fromAssetCode);
    const toAsset = await this.assetsService.findByCode(dto.toAssetCode);

    if (!fromAsset || !toAsset) {
      throw new NotFoundException({
        code: 'exchange_asset_not_found',
        message: 'Không tìm thấy tài sản dùng để đổi tiền.',
      });
    }

    const fromAmountMinor = parsePositiveAmountToMinorUnits(
      dto.amount,
      fromAsset.assetPrecision,
    );
    const requestedAmount = new Big(
      fromMinorUnits(fromAmountMinor, fromAsset.assetPrecision),
    );
    const realtimeRate = await this.exchangePricingService.getUsdtPriceInVnd();
    const direction = this.getExchangeDirection(dto.fromAssetCode, dto.toAssetCode);
    const appliedMarkupVnd = await this.getAppliedMarkupVnd(direction);
    const rate = this.buildRate(realtimeRate, direction, appliedMarkupVnd);
    const feeBps = await this.getFeeBps(direction);
    const grossReceiveMinor = this.calculateRoundedOutputMinorAtRate({
      direction,
      fromAmountMinor,
      fromPrecision: fromAsset.assetPrecision,
      rateVnd: rate.toFixed(0),
      toPrecision: toAsset.assetPrecision,
    });
    const feeAmountMinor = calculateFeeMinorUnits({
      amountMinor: grossReceiveMinor,
      feeBps,
      precision: toAsset.assetPrecision,
      rounding: 'up',
    });
    const totalDebitMinor = fromAmountMinor;
    const rateString = rate.toFixed(0);
    const toAmountMinor = grossReceiveMinor - feeAmountMinor;

    if (toAmountMinor <= 0n) {
      throw new BadRequestException({
        code: 'exchange_amount_below_fee',
        message: 'Số tiền đổi phải lớn hơn phí giao dịch để nhận được tiền.',
      });
    }

    const feeProfitVndMinor = this.calculateFeeProfitVndMinor({
      assetCode: toAsset.code,
      assetPrecision: toAsset.assetPrecision,
      feeAmountMinor,
      realtimeRateVnd: realtimeRate,
    });
    const markupProfitVndMinor = this.calculateMarkupProfitVndMinor({
      direction,
      fromAmountMinor,
      fromPrecision: fromAsset.assetPrecision,
      grossReceiveMinor,
      realtimeRateVnd: realtimeRate,
      toPrecision: toAsset.assetPrecision,
    });

    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.databaseService.db.insert(exchangeQuotes).values({
      appliedMarkupVnd,
      feeProfitVndMinor,
      id: quoteId,
      markupProfitVndMinor,
      userId,
      fromAssetId: fromAsset.id,
      toAssetId: toAsset.id,
      fromAmountMinor,
      feeAmountMinor,
      totalDebitMinor,
      toAmountMinor,
      rate: rateString,
      realtimeRateVnd: realtimeRate,
      feeBps,
      expiresAt,
    });

    return {
      expiresAt,
      feeAmount: fromMinorUnits(feeAmountMinor, toAsset.assetPrecision),
      feeAssetCode: toAsset.code,
      feeBps,
      fromAmount: fromMinorUnits(fromAmountMinor, fromAsset.assetPrecision),
      fromAssetCode: fromAsset.code,
      grossReceiveAmount: fromMinorUnits(
        grossReceiveMinor,
        toAsset.assetPrecision,
      ),
      id: quoteId,
      rate: rateString,
      requestedAmount: fromMinorUnits(
        fromAmountMinor,
        fromAsset.assetPrecision,
      ),
      roundingMode: 'floor_asset_precision',
      totalDebit: fromMinorUnits(totalDebitMinor, fromAsset.assetPrecision),
      toAmount: fromMinorUnits(toAmountMinor, toAsset.assetPrecision),
      toAssetCode: toAsset.code,
    };
  }

  async listForUser(userId: string) {
    const fromAssets = alias(assets, 'exchange_from_assets');
    const toAssets = alias(assets, 'exchange_to_assets');
    const rows = await this.databaseService.db
      .select({
        createdAt: exchangeOrders.createdAt,
        feeAmountMinor: exchangeOrders.feeAmountMinor,
        feeBps: exchangeOrders.feeBps,
        fromAmountMinor: exchangeOrders.fromAmountMinor,
        fromAssetCode: fromAssets.code,
        fromPrecision: fromAssets.assetPrecision,
        id: exchangeOrders.id,
        rate: exchangeOrders.rate,
        reversedAt: exchangeOrders.reversedAt,
        status: exchangeOrders.status,
        toAmountMinor: exchangeOrders.toAmountMinor,
        toAssetCode: toAssets.code,
        toPrecision: toAssets.assetPrecision,
        totalDebitMinor: exchangeOrders.totalDebitMinor,
      })
      .from(exchangeOrders)
      .innerJoin(fromAssets, eq(exchangeOrders.fromAssetId, fromAssets.id))
      .innerJoin(toAssets, eq(exchangeOrders.toAssetId, toAssets.id))
      .where(eq(exchangeOrders.userId, userId))
      .orderBy(desc(exchangeOrders.createdAt));

    return rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      feeAmount: fromMinorUnits(row.feeAmountMinor, row.toPrecision),
      feeBps: row.feeBps,
      fromAssetCode: row.fromAssetCode,
      id: row.id,
      rate: String(row.rate),
      requestedAmount: fromMinorUnits(row.fromAmountMinor, row.fromPrecision),
      reversedAt: row.reversedAt?.toISOString() ?? null,
      roundingMode: 'floor_asset_precision',
      status: row.status,
      grossReceiveAmount: fromMinorUnits(
        row.toAmountMinor + row.feeAmountMinor,
        row.toPrecision,
      ),
      feeAssetCode: row.toAssetCode,
      toAmount: fromMinorUnits(row.toAmountMinor, row.toPrecision),
      toAssetCode: row.toAssetCode,
      totalDebit: fromMinorUnits(row.totalDebitMinor, row.fromPrecision),
    }));
  }

  async listForAdmin(dateRange?: VietnamDateRangeQuery, search?: string) {
    const fromAssets = alias(assets, 'admin_exchange_from_assets');
    const toAssets = alias(assets, 'admin_exchange_to_assets');
    const query = this.databaseService.db
      .select({
        appliedMarkupVnd: exchangeOrders.appliedMarkupVnd,
        createdAt: exchangeOrders.createdAt,
        feeAmountMinor: exchangeOrders.feeAmountMinor,
        feeBps: exchangeOrders.feeBps,
        feeProfitVndMinor: exchangeOrders.feeProfitVndMinor,
        fromAmountMinor: exchangeOrders.fromAmountMinor,
        fromAssetCode: fromAssets.code,
        fromPrecision: fromAssets.assetPrecision,
        id: exchangeOrders.id,
        markupProfitVndMinor: exchangeOrders.markupProfitVndMinor,
        rate: exchangeOrders.rate,
        realtimeRateVnd: exchangeOrders.realtimeRateVnd,
        reversedAt: exchangeOrders.reversedAt,
        status: exchangeOrders.status,
        toAmountMinor: exchangeOrders.toAmountMinor,
        toAssetCode: toAssets.code,
        toPrecision: toAssets.assetPrecision,
        totalDebitMinor: exchangeOrders.totalDebitMinor,
        userEmail: users.email,
        userId: exchangeOrders.userId,
        userPhone: users.phone,
      })
      .from(exchangeOrders)
      .innerJoin(fromAssets, eq(exchangeOrders.fromAssetId, fromAssets.id))
      .innerJoin(toAssets, eq(exchangeOrders.toAssetId, toAssets.id))
      .innerJoin(users, eq(exchangeOrders.userId, users.id))
      .orderBy(desc(exchangeOrders.createdAt));

    const filters: SQL[] = [];
    if (dateRange) {
      filters.push(gte(exchangeOrders.createdAt, dateRange.start));
      filters.push(lt(exchangeOrders.createdAt, dateRange.endExclusive));
    }

    const rows =
      filters.length === 0 ? await query : await query.where(and(...filters));

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
      appliedMarkupVnd: row.appliedMarkupVnd,
      createdAt: row.createdAt.toISOString(),
      feeAmount: fromMinorUnits(row.feeAmountMinor, row.toPrecision),
      feeBps: row.feeBps,
      feeProfitVnd: fromMinorUnits(row.feeProfitVndMinor, 0),
      fromAssetCode: row.fromAssetCode,
      id: row.id,
      markupProfitVnd: fromMinorUnits(row.markupProfitVndMinor, 0),
      rate: String(row.rate),
      realtimeRateVnd: String(row.realtimeRateVnd),
      requestedAmount: fromMinorUnits(row.fromAmountMinor, row.fromPrecision),
      reversedAt: row.reversedAt?.toISOString() ?? null,
      status: row.status,
      grossReceiveAmount: fromMinorUnits(
        row.toAmountMinor + row.feeAmountMinor,
        row.toPrecision,
      ),
      feeAssetCode: row.toAssetCode,
      toAmount: fromMinorUnits(row.toAmountMinor, row.toPrecision),
      toAssetCode: row.toAssetCode,
      totalDebit: fromMinorUnits(row.totalDebitMinor, row.fromPrecision),
      userEmail: row.userEmail,
      userId: row.userId,
      userPhone: row.userPhone,
    }));
  }

  async execute(userId: string, quoteId: string, idempotencyKey: string) {
    await this.idempotencyService.claim(
      userId,
      'exchange:execute',
      idempotencyKey,
    );
    const orderId = randomUUID();

    await this.databaseService.db.transaction(async (tx) => {
      const [quote] = await tx
        .select()
        .from(exchangeQuotes)
        .where(
          and(
            eq(exchangeQuotes.id, quoteId),
            eq(exchangeQuotes.userId, userId),
          ),
        )
        .for('update');

      if (!quote) {
        throw new NotFoundException({
          code: 'exchange_quote_not_found',
          message: 'Không tìm thấy báo giá đổi tiền.',
        });
      }

      if (quote.executedAt) {
        throw new ConflictException({
          code: 'exchange_quote_executed',
          message: 'Báo giá này đã được thực hiện.',
        });
      }

      if (new Date(quote.expiresAt) < new Date()) {
        throw new ConflictException({
          code: 'exchange_quote_expired',
          message: 'Báo giá đổi tiền đã hết hạn.',
        });
      }

      const fromWallet = await this.walletsService.getWalletByUserAndAssetId(
        userId,
        quote.fromAssetId,
      );
      const toWallet = await this.walletsService.getWalletByUserAndAssetId(
        userId,
        quote.toAssetId,
      );
      const walletIds = [...new Set([fromWallet.id, toWallet.id])].sort();
      const lockedWallets = new Map<
        string,
        Awaited<ReturnType<LedgerService['lockWallet']>>
      >();

      for (const walletId of walletIds) {
        lockedWallets.set(
          walletId,
          await this.ledgerService.lockWallet(tx, walletId),
        );
      }

      const lockedFromWallet = lockedWallets.get(fromWallet.id);
      const lockedToWallet = lockedWallets.get(toWallet.id);

      if (!lockedFromWallet || !lockedToWallet) {
        throw new NotFoundException({
          code: 'wallet_not_found',
          message: 'Không tìm thấy ví của người dùng.',
        });
      }

      const fromAsset = await this.assetsService.findById(quote.fromAssetId);
      const toAsset = await this.assetsService.findById(quote.toAssetId);

      if (!fromAsset || !toAsset) {
        throw new NotFoundException({
          code: 'exchange_asset_not_found',
          message: 'Không tìm thấy tài sản dùng để đổi tiền.',
        });
      }

      await this.ledgerService.debitAvailableAndTotal(
        tx,
        fromWallet.id,
        quote.totalDebitMinor,
        'exchange_order',
        orderId,
        'Đổi tiền - tổng trừ',
        idempotencyKey,
        lockedFromWallet,
      );
      lockedFromWallet.availableMinor -= quote.totalDebitMinor;
      lockedFromWallet.totalMinor -= quote.totalDebitMinor;

      await this.ledgerService.creditAvailableAndTotal(
        tx,
        toWallet.id,
        quote.toAmountMinor,
        'exchange_order',
        orderId,
        'Đổi tiền - tiền nhận',
        idempotencyKey,
        lockedToWallet,
      );

      await tx.insert(exchangeOrders).values({
        appliedMarkupVnd: quote.appliedMarkupVnd ?? 0,
        feeBps: quote.feeBps ?? 0,
        id: orderId,
        userId,
        quoteId: quote.id,
        fromAssetId: quote.fromAssetId,
        toAssetId: quote.toAssetId,
        fromAmountMinor: quote.fromAmountMinor,
        feeAmountMinor: quote.feeAmountMinor,
        feeProfitVndMinor: quote.feeProfitVndMinor ?? 0n,
        markupProfitVndMinor: quote.markupProfitVndMinor ?? 0n,
        realtimeRateVnd: quote.realtimeRateVnd ?? quote.rate,
        totalDebitMinor: quote.totalDebitMinor,
        toAmountMinor: quote.toAmountMinor,
        rate: quote.rate,
      });

      await tx
        .update(exchangeQuotes)
        .set({
          executedAt: new Date(),
        })
        .where(eq(exchangeQuotes.id, quote.id));

      await this.userNotificationsService.createExchangeCompleted(tx, {
        fromAssetCode: fromAsset.code,
        referenceId: orderId,
        toAmount: fromMinorUnits(quote.toAmountMinor, toAsset.assetPrecision),
        toAssetCode: toAsset.code,
        totalDebit: fromMinorUnits(
          quote.totalDebitMinor,
          fromAsset.assetPrecision,
        ),
        userId,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: userId,
        action: 'exchange.executed',
        entityType: 'exchange_order',
        entityId: orderId,
        metadata: { quoteId },
      });
    });

    return {
      orderId,
      success: true,
    };
  }

  async reverse(adminUserId: string, orderId: string) {
    await this.databaseService.db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(exchangeOrders)
        .where(eq(exchangeOrders.id, orderId))
        .for('update');

      if (!order) {
        throw new NotFoundException({
          code: 'exchange_order_not_found',
          message: 'Không tìm thấy lệnh đổi tiền.',
        });
      }

      if (order.status !== 'completed') {
        throw new ConflictException({
          code: 'exchange_reverse_invalid_state',
          message: 'Lệnh đổi tiền này hiện không còn ở trạng thái có thể khôi phục.',
        });
      }

      const fromWallet = await this.walletsService.getWalletByUserAndAssetId(
        order.userId,
        order.fromAssetId,
      );
      const toWallet = await this.walletsService.getWalletByUserAndAssetId(
        order.userId,
        order.toAssetId,
      );
      const walletIds = [...new Set([fromWallet.id, toWallet.id])].sort();
      const lockedWallets = new Map<
        string,
        Awaited<ReturnType<LedgerService['lockWallet']>>
      >();

      for (const walletId of walletIds) {
        lockedWallets.set(
          walletId,
          await this.ledgerService.lockWallet(tx, walletId),
        );
      }

      const lockedFromWallet = lockedWallets.get(fromWallet.id);
      const lockedToWallet = lockedWallets.get(toWallet.id);

      if (!lockedFromWallet || !lockedToWallet) {
        throw new NotFoundException({
          code: 'wallet_not_found',
          message: 'Không tìm thấy ví của người dùng.',
        });
      }

      if (lockedToWallet.availableMinor < order.toAmountMinor) {
        throw new ConflictException({
          code: 'exchange_reverse_insufficient_received_balance',
          message:
            'Số dư tài sản đã nhận hiện không đủ để khôi phục lệnh đổi tiền này.',
        });
      }

      const fromAsset = await this.assetsService.findById(order.fromAssetId);
      const toAsset = await this.assetsService.findById(order.toAssetId);

      if (!fromAsset || !toAsset) {
        throw new NotFoundException({
          code: 'exchange_asset_not_found',
          message: 'Không tìm thấy tài sản dùng để đổi tiền.',
        });
      }

      await this.ledgerService.debitAvailableAndTotal(
        tx,
        lockedToWallet.id,
        order.toAmountMinor,
        'exchange_order',
        order.id,
        'Khôi phục đổi tiền - thu hồi tiền nhận',
        undefined,
        lockedToWallet,
      );
      lockedToWallet.availableMinor -= order.toAmountMinor;
      lockedToWallet.totalMinor -= order.toAmountMinor;

      await this.ledgerService.creditAvailableAndTotal(
        tx,
        lockedFromWallet.id,
        order.totalDebitMinor,
        'exchange_order',
        order.id,
        'Khôi phục đổi tiền - hoàn lại tiền nguồn',
        undefined,
        lockedFromWallet,
      );

      await tx
        .update(exchangeOrders)
        .set({
          reversedAt: new Date(),
          reversedBy: adminUserId,
          status: 'reversed',
        })
        .where(eq(exchangeOrders.id, order.id));

      await this.userNotificationsService.createExchangeReversed(tx, {
        fromAssetCode: fromAsset.code,
        referenceId: order.id,
        toAmount: fromMinorUnits(order.toAmountMinor, toAsset.assetPrecision),
        toAssetCode: toAsset.code,
        totalDebit: fromMinorUnits(
          order.totalDebitMinor,
          fromAsset.assetPrecision,
        ),
        userId: order.userId,
      });

      await this.auditService.logWithTransaction(tx, {
        actorUserId: adminUserId,
        action: 'exchange.reversed',
        entityType: 'exchange_order',
        entityId: order.id,
        metadata: {
          totalDebitMinor: order.totalDebitMinor.toString(),
          toAmountMinor: order.toAmountMinor.toString(),
        },
      });
    });

    return {
      success: true,
    };
  }

  private assertSupportedDirection(fromAssetCode: string, toAssetCode: string) {
    if (
      (fromAssetCode === 'VND' && toAssetCode === 'USDT') ||
      (fromAssetCode === 'USDT' && toAssetCode === 'VND')
    ) {
      return;
    }

    throw new BadRequestException({
      code: 'exchange_direction_not_supported',
      message: 'Hệ thống hiện chỉ hỗ trợ đổi giữa VND và USDT.',
    });
  }

  private getExchangeDirection(fromAssetCode: string, toAssetCode: string) {
    if (fromAssetCode === 'VND' && toAssetCode === 'USDT') {
      return 'vnd_to_usdt' as const;
    }

    return 'usdt_to_vnd' as const;
  }

  private buildRate(
    realtimeRate: string,
    direction: 'usdt_to_vnd' | 'vnd_to_usdt',
    appliedMarkupVnd: number,
  ) {
    const rate =
      direction === 'vnd_to_usdt'
        ? new Big(realtimeRate).plus(appliedMarkupVnd)
        : new Big(realtimeRate).minus(appliedMarkupVnd);

    if (rate.lte(0)) {
      throw new BadRequestException({
        code: 'exchange_rate_not_configured',
        message: 'Hiện chưa có tỷ giá cho cặp tài sản này.',
      });
    }

    return rate;
  }

  private async getAppliedMarkupVnd(direction: 'usdt_to_vnd' | 'vnd_to_usdt') {
    if (direction === 'vnd_to_usdt') {
      return this.settingsService.getExchangeVndToUsdtMarkupVnd();
    }

    return this.settingsService.getExchangeUsdtToVndMarkupVnd();
  }

  private async getFeeBps(direction: 'usdt_to_vnd' | 'vnd_to_usdt') {
    if (direction === 'vnd_to_usdt') {
      return this.settingsService.getExchangeVndToUsdtFeeBps();
    }

    return this.settingsService.getExchangeUsdtToVndFeeBps();
  }

  private calculateFeeProfitVndMinor(input: {
    assetCode: string;
    assetPrecision: number;
    feeAmountMinor: bigint;
    realtimeRateVnd: string;
  }) {
    if (input.assetCode === 'VND') {
      return input.feeAmountMinor;
    }

    return this.convertAssetMinorToVndMinor(
      input.feeAmountMinor,
      input.assetPrecision,
      input.realtimeRateVnd,
    );
  }

  private calculateMarkupProfitVndMinor(input: {
    direction: 'usdt_to_vnd' | 'vnd_to_usdt';
    fromAmountMinor: bigint;
    fromPrecision: number;
    grossReceiveMinor: bigint;
    realtimeRateVnd: string;
    toPrecision: number;
  }) {
    const noMarkupToAmountMinor = this.calculateRoundedOutputMinorAtRate({
      direction: input.direction,
      fromAmountMinor: input.fromAmountMinor,
      fromPrecision: input.fromPrecision,
      rateVnd: input.realtimeRateVnd,
      toPrecision: input.toPrecision,
    });
    const outputDeltaMinor = noMarkupToAmountMinor - input.grossReceiveMinor;

    if (outputDeltaMinor <= 0n) {
      return 0n;
    }

    const markupProfit =
      input.direction === 'vnd_to_usdt'
        ? this.convertAssetMinorToVndMinor(
            outputDeltaMinor,
            input.toPrecision,
            input.realtimeRateVnd,
          )
        : outputDeltaMinor;

    return markupProfit > 0n ? markupProfit : 0n;
  }

  private calculateRoundedOutputMinorAtRate(input: {
    direction: 'usdt_to_vnd' | 'vnd_to_usdt';
    fromAmountMinor: bigint;
    fromPrecision: number;
    rateVnd: string;
    toPrecision: number;
  }) {
    const fromAmount = new Big(
      fromMinorUnits(input.fromAmountMinor, input.fromPrecision),
    );
    const toAmount =
      input.direction === 'vnd_to_usdt'
        ? fromAmount.div(input.rateVnd)
        : fromAmount.times(input.rateVnd);
    const roundedToAmount = toAmount.round(input.toPrecision, Big.roundDown);

    return toMinorUnits(
      roundedToAmount.toFixed(input.toPrecision),
      input.toPrecision,
    );
  }

  private convertAssetMinorToVndMinor(
    amountMinor: bigint,
    assetPrecision: number,
    realtimeRateVnd: string,
  ) {
    return BigInt(
      new Big(fromMinorUnits(amountMinor, assetPrecision))
        .times(realtimeRateVnd)
        .round(0, Big.roundDown)
        .toFixed(0),
    );
  }
}
