import { DepositsService } from './deposits.service';

describe('DepositsService', () => {
  it('cancels a pending deposit for the owning user and cancels its linked reservation', async () => {
    const forUpdate = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'deposit-1',
          status: 'pending',
          userId: 'user-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'reservation-1',
        },
      ]);
    const where = jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        for: forUpdate,
      }),
    });
    const set = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where,
        }),
      }),
      update: jest.fn().mockReturnValue({
        set,
      }),
    };
    const auditService = {
      logWithTransaction: jest.fn().mockResolvedValue(undefined),
    };

    const service = new DepositsService(
      {} as never,
      auditService as never,
      {} as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<void>,
          ) => callback(tx),
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(service.cancel('user-1', 'deposit-1')).resolves.toEqual({
      success: true,
    });

    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        cancelledAt: expect.any(Date),
        reviewNote: 'Hủy bởi người dùng',
        status: 'cancelled',
      }),
    );
    expect(set).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: 'cancelled',
      }),
    );
    expect(auditService.logWithTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'deposit.cancelled_by_user',
        actorUserId: 'user-1',
        entityId: 'deposit-1',
      }),
    );
  });

  it('creates user notifications when deposits are approved and rejected', async () => {
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest
              .fn()
              .mockResolvedValueOnce([
                {
                  amountMinor: 250000n,
                  assetId: 'asset-vnd',
                  bankAccountId: null,
                  id: 'deposit-approve',
                  status: 'pending',
                  userId: 'user-1',
                },
              ])
              .mockResolvedValueOnce([
                {
                  amountMinor: 250000n,
                  assetId: 'asset-vnd',
                  bankAccountId: null,
                  id: 'deposit-reject',
                  status: 'pending',
                  userId: 'user-1',
                },
              ]),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    const userNotificationsService = {
      createDepositApproved: jest.fn().mockResolvedValue(undefined),
      createDepositRejected: jest.fn().mockResolvedValue(undefined),
    };

    const service = new DepositsService(
      {
        findById: jest.fn().mockResolvedValue({
          assetPrecision: 0,
          code: 'VND',
          id: 'asset-vnd',
        }),
      } as never,
      {
        log: jest.fn().mockResolvedValue(undefined),
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        incrementUsageOnApproval: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<void>,
          ) => callback(tx),
        },
      } as never,
      {} as never,
      {
        creditAvailableAndTotal: jest.fn().mockResolvedValue(undefined),
        lockWallet: jest.fn().mockResolvedValue({
          availableMinor: 0n,
          id: 'wallet-vnd',
          pendingMinor: 0n,
          totalMinor: 0n,
        }),
      } as never,
      {} as never,
      {
        getWalletByUserAndAssetId: jest.fn().mockResolvedValue({ id: 'wallet-vnd' }),
      } as never,
      userNotificationsService as never,
    );

    await service.approve('admin-1', 'deposit-approve', 'Da duyet');
    await service.reject('admin-1', 'deposit-reject', 'Sai noi dung');

    expect(userNotificationsService.createDepositApproved).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amount: '250000',
        assetCode: 'VND',
        depositRequestId: 'deposit-approve',
        userId: 'user-1',
      }),
    );
    expect(userNotificationsService.createDepositRejected).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        amount: '250000',
        assetCode: 'VND',
        depositRequestId: 'deposit-reject',
        reviewNote: 'Sai noi dung',
        userId: 'user-1',
      }),
    );
  });

  it.each([
    ['partial email', 'alice', 'deposit-alice'],
    ['partial phone', '3456', 'deposit-alice'],
    ['partial userId', 'bbb', 'deposit-bob'],
  ])(
    'filters admin deposits by %s',
    async (_label, search, expectedId) => {
      const rows = [
        {
          id: 'deposit-alice',
          userId: 'user-aaa',
          userEmail: 'alice@example.com',
          userPhone: '0901234567',
          amountMinor: 100000n,
          assetCode: 'VND',
          precision: 0,
          method: 'bank_transfer',
          status: 'pending',
          note: null,
          reviewNote: null,
          bankAccountId: null,
          destinationRef: 'NAP ALICE',
          externalReference: null,
          proofUrl: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankCode: null,
          bankName: null,
          bankPriority: null,
          createdAt: new Date('2026-04-10T00:00:00.000Z'),
          approvedAt: null,
          rejectedAt: null,
        },
        {
          id: 'deposit-bob',
          userId: 'user-bbb',
          userEmail: 'bob@example.com',
          userPhone: '0987654321',
          amountMinor: 200000n,
          assetCode: 'VND',
          precision: 0,
          method: 'bank_transfer',
          status: 'pending',
          note: null,
          reviewNote: null,
          bankAccountId: null,
          destinationRef: 'NAP BOB',
          externalReference: null,
          proofUrl: null,
          bankAccountName: null,
          bankAccountNumber: null,
          bankCode: null,
          bankName: null,
          bankPriority: null,
          createdAt: new Date('2026-04-11T00:00:00.000Z'),
          approvedAt: null,
          rejectedAt: null,
        },
      ];
      const where = jest.fn().mockResolvedValue(rows);

      const service = new DepositsService(
        {} as never,
        {} as never,
        {} as never,
        {
          db: {
            select: jest.fn().mockReturnValue({
              from: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  innerJoin: jest.fn().mockReturnValue({
                    leftJoin: jest.fn().mockReturnValue({
                      orderBy: jest.fn().mockReturnValue({
                        where,
                      }),
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
      );

      const result = await service.listForAdmin('all', undefined, search);

      expect(where).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: expectedId,
          userPhone: expect.any(String),
        }),
      );
    },
  );
});
