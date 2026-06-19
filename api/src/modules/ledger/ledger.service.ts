import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { AppTransaction } from '../../platform/database/database.types';
import { ledgerEntries, wallets } from '../../platform/database/schema';

type WalletBucket = 'available' | 'pending' | 'total';
type WalletDirection = 'credit' | 'debit';

type LockedWallet = typeof wallets.$inferSelect;

type WalletMutation = {
  amountMinor: bigint;
  bucket: WalletBucket;
  direction: WalletDirection;
};

type MutationContext = {
  idempotencyKey?: string;
  note?: string;
  referenceId: string;
  referenceType: string;
};

type WalletBalances = Pick<
  LockedWallet,
  'availableMinor' | 'pendingMinor' | 'totalMinor'
>;

@Injectable()
export class LedgerService {
  async lockWallet(tx: AppTransaction, walletId: string) {
    const [wallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .for('update');

    if (!wallet) {
      throw new NotFoundException({
        code: 'wallet_not_found',
        message: 'Không tìm thấy ví của người dùng.',
      });
    }

    return wallet;
  }

  async creditAvailableAndTotal(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'available',
          direction: 'credit',
        },
        {
          amountMinor,
          bucket: 'total',
          direction: 'credit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  async reserveAvailableToPending(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'available',
          direction: 'debit',
        },
        {
          amountMinor,
          bucket: 'pending',
          direction: 'credit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  async releasePendingToAvailable(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'pending',
          direction: 'debit',
        },
        {
          amountMinor,
          bucket: 'available',
          direction: 'credit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  async settlePendingAndTotal(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'pending',
          direction: 'debit',
        },
        {
          amountMinor,
          bucket: 'total',
          direction: 'debit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  async restoreSettledToPendingAndTotal(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'pending',
          direction: 'credit',
        },
        {
          amountMinor,
          bucket: 'total',
          direction: 'credit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  async debitAvailableAndTotal(
    tx: AppTransaction,
    walletId: string,
    amountMinor: bigint,
    referenceType: string,
    referenceId: string,
    note?: string,
    idempotencyKey?: string,
    lockedWallet?: LockedWallet,
  ) {
    await this.applyWalletMutations(
      tx,
      lockedWallet ?? walletId,
      [
        {
          amountMinor,
          bucket: 'available',
          direction: 'debit',
        },
        {
          amountMinor,
          bucket: 'total',
          direction: 'debit',
        },
      ],
      {
        idempotencyKey,
        note,
        referenceId,
        referenceType,
      },
    );
  }

  private async applyWalletMutations(
    tx: AppTransaction,
    walletOrId: LockedWallet | string,
    mutations: WalletMutation[],
    context: MutationContext,
  ) {
    const wallet =
      typeof walletOrId === 'string'
        ? await this.lockWallet(tx, walletOrId)
        : walletOrId;

    let nextBalances: WalletBalances = {
      availableMinor: wallet.availableMinor,
      pendingMinor: wallet.pendingMinor,
      totalMinor: wallet.totalMinor,
    };

    const ledgerRows = mutations.map((mutation) => {
      const currentAmount = this.readBucketBalance(
        nextBalances,
        mutation.bucket,
      );
      const nextAmount = this.applySignedAmount(
        currentAmount,
        mutation.direction,
        mutation.amountMinor,
      );

      if (nextAmount < 0n) {
        throw new ConflictException({
          code: 'insufficient_balance',
          message: 'Số dư khả dụng không đủ để thực hiện giao dịch.',
        });
      }

      nextBalances = this.writeBucketBalance(
        nextBalances,
        mutation.bucket,
        nextAmount,
      );

      return {
        amountMinor: mutation.amountMinor,
        balanceAfterMinor: nextAmount,
        balanceBeforeMinor: currentAmount,
        bucket: mutation.bucket,
        createdAt: new Date(),
        direction: mutation.direction,
        id: randomUUID(),
        idempotencyKey: context.idempotencyKey ?? null,
        note: context.note ?? null,
        referenceId: context.referenceId,
        referenceType: context.referenceType,
        walletId: wallet.id,
      };
    });

    await tx
      .update(wallets)
      .set({
        availableMinor: nextBalances.availableMinor,
        pendingMinor: nextBalances.pendingMinor,
        totalMinor: nextBalances.totalMinor,
      })
      .where(eq(wallets.id, wallet.id));

    await tx.insert(ledgerEntries).values(ledgerRows);
  }

  private applySignedAmount(
    current: bigint,
    direction: WalletDirection,
    amount: bigint,
  ) {
    return direction === 'credit' ? current + amount : current - amount;
  }

  private readBucketBalance(balances: WalletBalances, bucket: WalletBucket) {
    if (bucket === 'available') {
      return balances.availableMinor;
    }

    if (bucket === 'pending') {
      return balances.pendingMinor;
    }

    return balances.totalMinor;
  }

  private writeBucketBalance(
    balances: WalletBalances,
    bucket: WalletBucket,
    amount: bigint,
  ): WalletBalances {
    if (bucket === 'available') {
      return {
        ...balances,
        availableMinor: amount,
      };
    }

    if (bucket === 'pending') {
      return {
        ...balances,
        pendingMinor: amount,
      };
    }

    return {
      ...balances,
      totalMinor: amount,
    };
  }
}
