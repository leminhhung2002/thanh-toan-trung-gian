import { BadRequestException, ConflictException } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';

describe('WithdrawalsService', () => {
  function createService(options?: {
    asset?: { assetPrecision: number; code: 'USDT' | 'VND'; id: string };
    feeBps?: number;
    lockedWallet?: {
      availableMinor: bigint;
      id: string;
      pendingMinor: bigint;
      totalMinor: bigint;
    };
    withdrawalRows?: Array<{
      assetId: string;
      id: string;
      status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      totalDebitMinor: bigint;
      userId: string;
    }>;
  }) {
    const feeBps = options?.feeBps ?? 1000;
    const asset =
      options?.asset ?? {
        assetPrecision: 0,
        code: 'VND' as const,
        id: 'asset-vnd',
      };
    const withdrawalRows = [...(options?.withdrawalRows ?? [])];
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    const tx = {
      insert: jest.fn().mockReturnValue({
        values: insertValues,
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ email: 'user@example.com' }]),
            for: jest.fn().mockImplementation(async () => {
              const nextRow = withdrawalRows.shift();
              return nextRow ? [nextRow] : [];
            }),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: updateSet,
      }),
    };
    const userLimit = jest.fn().mockResolvedValue([{ email: 'user@example.com' }]);
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: userLimit,
          }),
        }),
      }),
      transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx);
      }),
    };

    const notificationOutboxService = {
      enqueueWithdrawalPendingCreated: jest.fn().mockResolvedValue(undefined),
    };
    const ledgerService = {
      lockWallet: jest.fn().mockResolvedValue(
        options?.lockedWallet ?? {
          availableMinor: 1000000n,
          id: asset.code === 'USDT' ? 'wallet-usdt' : 'wallet-vnd',
          pendingMinor: 0n,
          totalMinor: 1000000n,
        },
      ),
      releasePendingToAvailable: jest.fn().mockResolvedValue(undefined),
      reserveAvailableToPending: jest.fn().mockResolvedValue(undefined),
      settlePendingAndTotal: jest.fn().mockResolvedValue(undefined),
    };
    const userNotificationsService = {
      createWithdrawalApproved: jest.fn().mockResolvedValue(undefined),
      createWithdrawalCreated: jest.fn().mockResolvedValue(undefined),
      createWithdrawalRejected: jest.fn().mockResolvedValue(undefined),
    };
    const passwordConfirmationService = {
      assertValidCurrentPassword: jest.fn().mockResolvedValue(undefined),
    };

    const service = new WithdrawalsService(
      {
        findByCode: jest.fn().mockResolvedValue(asset),
        findById: jest.fn().mockResolvedValue(asset),
      } as never,
      {
        log: jest.fn().mockResolvedValue(undefined),
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        db,
      } as never,
      {
        getUsdtPriceInVnd: jest.fn().mockResolvedValue('25000'),
      } as never,
      {
        claim: jest.fn().mockResolvedValue(undefined),
      } as never,
      ledgerService as never,
      notificationOutboxService as never,
      {
        getWithdrawalFeeBps: jest.fn().mockResolvedValue(feeBps),
      } as never,
      passwordConfirmationService as never,
      {
        getWalletByUserAndAssetCode: jest.fn().mockResolvedValue({
          walletId: asset.code === 'USDT' ? 'wallet-usdt' : 'wallet-vnd',
        }),
        getWalletByUserAndAssetId: jest.fn().mockResolvedValue({
          id: asset.code === 'USDT' ? 'wallet-usdt' : 'wallet-vnd',
        }),
      } as never,
      userNotificationsService as never,
    );

    return {
      ledgerService,
      notificationOutboxService,
      passwordConfirmationService,
      service,
      tx,
      updateSet,
      userNotificationsService,
    };
  }

  it('cancels a pending withdrawal by releasing the exact stored total debit back to available', async () => {
    const { ledgerService, service, tx, updateSet, userNotificationsService } =
      createService({
      lockedWallet: {
        availableMinor: 1000n,
        id: 'wallet-vnd',
        pendingMinor: 101n,
        totalMinor: 1101n,
      },
      withdrawalRows: [
        {
          assetId: 'asset-vnd',
          id: 'withdrawal-cancel',
          status: 'pending',
          totalDebitMinor: 101n,
          userId: 'user-1',
        },
      ],
    });

    await expect(service.cancel('user-1', 'withdrawal-cancel')).resolves.toEqual({
      success: true,
    });

    expect(ledgerService.releasePendingToAvailable).toHaveBeenCalledWith(
      tx,
      'wallet-vnd',
      101n,
      'withdrawal_request',
      'withdrawal-cancel',
      'Hủy bởi người dùng',
      undefined,
      expect.objectContaining({
        pendingMinor: 101n,
      }),
    );
    expect(tx.update).toHaveBeenCalled();
    const setArg = updateSet.mock.calls.at(-1)?.[0];
    expect(setArg).toEqual(
      expect.objectContaining({
        cancelledAt: expect.any(Date),
        reviewNote: 'Hủy bởi người dùng',
        status: 'cancelled',
      }),
    );
    expect(userNotificationsService.createWithdrawalRejected).not.toHaveBeenCalled();
  });

  it('refuses to cancel when the pending balance no longer matches the stored rollback amount', async () => {
    const { service } = createService({
      lockedWallet: {
        availableMinor: 1000n,
        id: 'wallet-vnd',
        pendingMinor: 100n,
        totalMinor: 1100n,
      },
      withdrawalRows: [
        {
          assetId: 'asset-vnd',
          id: 'withdrawal-mismatch',
          status: 'pending',
          totalDebitMinor: 101n,
          userId: 'user-1',
        },
      ],
    });

    await expect(service.cancel('user-1', 'withdrawal-mismatch')).rejects.toThrow(
      ConflictException,
    );
  });

  it('treats the create input amount as gross debit and stores the net receive amount', async () => {
    const {
      ledgerService,
      notificationOutboxService,
      passwordConfirmationService,
      service,
    } = createService();

    const result = await service.create(
      'user-1',
      {
        amount: '100000',
        assetCode: 'VND',
        currentPassword: 'Secret123!',
        destinationDetails: {
          accountName: 'Alice',
          accountNumber: '123',
          bankName: 'VCB',
        },
        method: 'bank_transfer',
        note: 'withdraw all',
      },
      'idem-1',
    );

    expect(result).toMatchObject({
      amount: '90000',
      assetCode: 'VND',
      feeAmount: '10000',
      status: 'pending',
      totalDebit: '100000',
    });
    expect(notificationOutboxService.enqueueWithdrawalPendingCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: '90000',
        feeAmount: '10000',
        totalDebit: '100000',
      }),
    );
    expect(ledgerService.reserveAvailableToPending).toHaveBeenCalledWith(
      expect.anything(),
      'wallet-vnd',
      100000n,
      'withdrawal_request',
      expect.any(String),
      'withdraw all',
      'idem-1',
    );
    expect(passwordConfirmationService.assertValidCurrentPassword).toHaveBeenCalledWith(
      'user-1',
      'Secret123!',
    );
  });

  it('rounds VND fees up so the stored net amount favors the platform', async () => {
    const { notificationOutboxService, service } = createService({
      feeBps: 125,
    });

    const result = await service.create(
      'user-1',
      {
        amount: '101',
        assetCode: 'VND',
        currentPassword: 'Secret123!',
        destinationDetails: {
          accountName: 'Alice',
          accountNumber: '123',
          bankName: 'VCB',
        },
        method: 'bank_transfer',
        note: 'withdraw all',
      },
      'idem-1',
    );

    expect(result).toMatchObject({
      amount: '99',
      feeAmount: '2',
      totalDebit: '101',
    });
    expect(notificationOutboxService.enqueueWithdrawalPendingCreated).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: '99',
        feeAmount: '2',
        totalDebit: '101',
      }),
    );
  });

  it('rejects gross debit requests that leave no net amount after fee', async () => {
    const { service } = createService({ feeBps: 10000 });

    await expect(
      service.create(
        'user-1',
        {
          amount: '1',
          assetCode: 'VND',
          currentPassword: 'Secret123!',
          destinationDetails: {
            accountName: 'Alice',
            accountNumber: '123',
            bankName: 'VCB',
          },
          method: 'bank_transfer',
        },
        'idem-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates user notifications only for approved and rejected withdrawals', async () => {
    const createdAt = new Date('2026-04-12T10:00:00.000Z');
    const dateSpy = jest
      .spyOn(global, 'Date')
      .mockImplementationOnce(() => createdAt as never);
    const { service, tx, userNotificationsService } = createService({
      feeBps: 500,
      withdrawalRows: [
        {
          assetId: 'asset-vnd',
          id: 'withdrawal-approved',
          status: 'pending',
          totalDebitMinor: 52500n,
          userId: 'user-1',
        },
        {
          assetId: 'asset-vnd',
          id: 'withdrawal-rejected',
          status: 'pending',
          totalDebitMinor: 52500n,
          userId: 'user-1',
        },
      ],
    });

    try {
      await service.create(
        'user-1',
        {
          amount: '50000',
          assetCode: 'VND',
          currentPassword: 'Secret123!',
          destinationDetails: {
            accountName: 'NGUYEN VAN A',
            accountNumber: '123456789',
            bankName: 'Vietcombank',
            method: 'bank_transfer',
          },
          method: 'bank_transfer',
          note: null,
        },
        'idem-withdrawal',
      );
      await service.approve('admin-1', 'withdrawal-approved', 'Da duyet');
      await service.reject('admin-1', 'withdrawal-rejected', 'Sai thong tin');
    } finally {
      dateSpy.mockRestore();
    }

    expect(userNotificationsService.createWithdrawalCreated).not.toHaveBeenCalled();
    expect(userNotificationsService.createWithdrawalApproved).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        assetCode: 'VND',
        totalDebit: '52500',
        userId: 'user-1',
        withdrawalRequestId: 'withdrawal-approved',
      }),
    );
    expect(userNotificationsService.createWithdrawalRejected).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        assetCode: 'VND',
        totalDebit: '52500',
        userId: 'user-1',
        withdrawalRequestId: 'withdrawal-rejected',
      }),
    );
  });

  it('applies admin withdrawal search on top of status and date-filtered results', async () => {
    const filteredRows = [
      {
        id: 'withdrawal-1',
        userId: 'user-1',
        userEmail: 'alice@example.com',
        userPhone: '0901234567',
        amountMinor: 90000n,
        assetCode: 'VND',
        feeAmountMinor: 10000n,
        feeProfitVndMinor: 10000n,
        precision: 0,
        method: 'bank_transfer',
        status: 'pending',
        note: null,
        reviewNote: null,
        destinationDetails: null,
        profitFxRateVnd: null,
        totalDebitMinor: 100000n,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        approvedAt: null,
        rejectedAt: null,
      },
      {
        id: 'withdrawal-2',
        userId: 'user-2',
        userEmail: 'bob@example.com',
        userPhone: '0987654321',
        amountMinor: 45000n,
        assetCode: 'VND',
        feeAmountMinor: 5000n,
        feeProfitVndMinor: 5000n,
        precision: 0,
        method: 'bank_transfer',
        status: 'pending',
        note: null,
        reviewNote: null,
        destinationDetails: null,
        profitFxRateVnd: null,
        totalDebitMinor: 50000n,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        approvedAt: null,
        rejectedAt: null,
      },
    ];
    const where = jest.fn().mockResolvedValue(filteredRows);

    const service = new WithdrawalsService(
      {} as never,
      {} as never,
      {
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  orderBy: jest.fn().mockReturnValue({
                    where,
                  }),
                }),
              }),
            }),
          }),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.listForAdmin(
      'pending',
      {
        endDate: '2026-04-10',
        endExclusive: new Date('2026-04-10T17:00:00.000Z'),
        start: new Date('2026-04-09T17:00:00.000Z'),
        startDate: '2026-04-10',
      },
      'alice',
    );

    expect(where).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'withdrawal-1',
        userPhone: '0901234567',
      }),
    );
  });
});
