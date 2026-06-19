import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../platform/database/database.service';
import { fromMinorUnits } from '../../platform/money/amounts';
import { assets, ledgerEntries, wallets } from '../../platform/database/schema';

@Injectable()
export class WalletsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async ensureWalletsForUser(userId: string, assetIds: string[]) {
    const existingWallets = await this.databaseService.db
      .select()
      .from(wallets)
      .where(
        and(eq(wallets.userId, userId), inArray(wallets.assetId, assetIds)),
      );

    const existingAssetIds = new Set(
      existingWallets.map((wallet) => wallet.assetId),
    );
    const inserts = assetIds
      .filter((assetId) => !existingAssetIds.has(assetId))
      .map((assetId) => ({
        id: randomUUID(),
        userId,
        assetId,
      }));

    if (inserts.length > 0) {
      await this.databaseService.db.insert(wallets).values(inserts);
    }
  }

  async listWalletsForUser(userId: string) {
    const rows = await this.databaseService.db
      .select({
        walletId: wallets.id,
        assetCode: assets.code,
        assetName: assets.name,
        precision: assets.assetPrecision,
        availableMinor: wallets.availableMinor,
        pendingMinor: wallets.pendingMinor,
        totalMinor: wallets.totalMinor,
      })
      .from(wallets)
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .where(eq(wallets.userId, userId));

    return rows.map((row) => ({
      assetCode: row.assetCode,
      assetName: row.assetName,
      walletId: row.walletId,
      balances: {
        available: fromMinorUnits(row.availableMinor, row.precision),
        pending: fromMinorUnits(row.pendingMinor, row.precision),
        total: fromMinorUnits(row.totalMinor, row.precision),
      },
    }));
  }

  async getWalletByUserAndAssetCode(userId: string, assetCode: string) {
    const [wallet] = await this.databaseService.db
      .select({
        walletId: wallets.id,
        assetId: wallets.assetId,
        assetCode: assets.code,
        assetName: assets.name,
        precision: assets.assetPrecision,
        availableMinor: wallets.availableMinor,
        pendingMinor: wallets.pendingMinor,
        totalMinor: wallets.totalMinor,
      })
      .from(wallets)
      .innerJoin(assets, eq(wallets.assetId, assets.id))
      .where(and(eq(wallets.userId, userId), eq(assets.code, assetCode)));

    if (!wallet) {
      throw new NotFoundException({
        code: 'wallet_not_found',
        message: 'Không tìm thấy ví của người dùng.',
      });
    }

    return wallet;
  }

  async getWalletByUserAndAssetId(userId: string, assetId: string) {
    const [wallet] = await this.databaseService.db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.assetId, assetId)));

    if (!wallet) {
      throw new NotFoundException({
        code: 'wallet_not_found',
        message: 'Không tìm thấy ví của người dùng.',
      });
    }

    return wallet;
  }

  async getLedgerForUser(userId: string, assetCode: string) {
    const wallet = await this.getWalletByUserAndAssetCode(userId, assetCode);
    const entries = await this.databaseService.db
      .select()
      .from(ledgerEntries)
      .where(eq(ledgerEntries.walletId, wallet.walletId))
      .orderBy(desc(ledgerEntries.createdAt));

    return {
      wallet: {
        assetCode: wallet.assetCode,
        balances: {
          available: fromMinorUnits(wallet.availableMinor, wallet.precision),
          pending: fromMinorUnits(wallet.pendingMinor, wallet.precision),
          total: fromMinorUnits(wallet.totalMinor, wallet.precision),
        },
      },
      entries: entries.map((entry) => ({
        amount: fromMinorUnits(entry.amountMinor, wallet.precision),
        id: entry.id,
        bucket: entry.bucket,
        direction: entry.direction,
        amountMinor: entry.amountMinor.toString(),
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        note: entry.note,
        createdAt: entry.createdAt,
      })),
    };
  }
}
