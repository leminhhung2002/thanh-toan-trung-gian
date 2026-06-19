import { ConflictException } from '@nestjs/common';
import { ExchangeService } from './exchange.service';

describe('ExchangeService', () => {
  it('quotes VND to USDT using gross source debit and net receive after fee on the destination asset', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({
        values: insertValues,
      }),
    };

    const service = new ExchangeService(
      {
        findByCode: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          })
          .mockResolvedValueOnce({
            assetPrecision: 2,
            code: 'USDT',
            id: 'asset-usdt',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getUsdtPriceInVnd: jest.fn().mockResolvedValue('25000'),
      } as never,
      {
        db,
      } as never,
      {} as never,
      {} as never,
      {
        getExchangeUsdtToVndFeeBps: jest.fn(),
        getExchangeUsdtToVndMarkupVnd: jest.fn(),
        getExchangeVndToUsdtFeeBps: jest.fn().mockResolvedValue(125),
        getExchangeVndToUsdtMarkupVnd: jest.fn().mockResolvedValue(1000),
      } as never,
      {} as never,
    );

    const result = await service.createQuote('user-1', {
      amount: '1000',
      fromAssetCode: 'VND',
      toAssetCode: 'USDT',
    });

    expect(result).toMatchObject({
      feeAmount: '0.01',
      feeAssetCode: 'USDT',
      feeBps: 125,
      fromAmount: '1000',
      fromAssetCode: 'VND',
      grossReceiveAmount: '0.03',
      rate: '26000',
      requestedAmount: '1000',
      toAmount: '0.02',
      toAssetCode: 'USDT',
      totalDebit: '1000',
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedMarkupVnd: 1000,
        feeAmountMinor: 1n,
        feeBps: 125,
        feeProfitVndMinor: 250n,
        fromAmountMinor: 1000n,
        markupProfitVndMinor: 250n,
        rate: '26000',
        realtimeRateVnd: '25000',
        toAmountMinor: 2n,
        totalDebitMinor: 1000n,
        userId: 'user-1',
      }),
    );
  });

  it('creates VND to USDT quotes with fee deducted from the converted USDT amount', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({
        values: insertValues,
      }),
    };

    const service = new ExchangeService(
      {
        findByCode: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          })
          .mockResolvedValueOnce({
            assetPrecision: 2,
            code: 'USDT',
            id: 'asset-usdt',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getUsdtPriceInVnd: jest.fn().mockResolvedValue('25000'),
      } as never,
      {
        db,
      } as never,
      {} as never,
      {} as never,
      {
        getExchangeUsdtToVndFeeBps: jest.fn(),
        getExchangeUsdtToVndMarkupVnd: jest.fn(),
        getExchangeVndToUsdtFeeBps: jest.fn().mockResolvedValue(100),
        getExchangeVndToUsdtMarkupVnd: jest.fn().mockResolvedValue(1000),
      } as never,
      {} as never,
      {} as never,
    );

    const result = await service.createQuote('user-1', {
      amount: '100000',
      fromAssetCode: 'VND',
      toAssetCode: 'USDT',
    });

    expect(result).toMatchObject({
      feeAmount: '0.04',
      feeAssetCode: 'USDT',
      feeBps: 100,
      fromAmount: '100000',
      fromAssetCode: 'VND',
      grossReceiveAmount: '3.84',
      rate: '26000',
      requestedAmount: '100000',
      toAmount: '3.80',
      toAssetCode: 'USDT',
      totalDebit: '100000',
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedMarkupVnd: 1000,
        feeAmountMinor: 4n,
        feeBps: 100,
        feeProfitVndMinor: 1000n,
        fromAmountMinor: 100000n,
        markupProfitVndMinor: 4000n,
        rate: '26000',
        realtimeRateVnd: '25000',
        toAmountMinor: 380n,
        totalDebitMinor: 100000n,
        userId: 'user-1',
      }),
    );
  });

  it('creates USDT to VND quotes with fee deducted from the converted VND amount', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({
        values: insertValues,
      }),
    };

    const service = new ExchangeService(
      {
        findByCode: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 2,
            code: 'USDT',
            id: 'asset-usdt',
          })
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getUsdtPriceInVnd: jest.fn().mockResolvedValue('25000'),
      } as never,
      {
        db,
      } as never,
      {} as never,
      {} as never,
      {
        getExchangeUsdtToVndFeeBps: jest.fn().mockResolvedValue(50),
        getExchangeUsdtToVndMarkupVnd: jest.fn().mockResolvedValue(700),
        getExchangeVndToUsdtFeeBps: jest.fn(),
        getExchangeVndToUsdtMarkupVnd: jest.fn(),
      } as never,
      {} as never,
      {} as never,
    );

    const result = await service.createQuote('user-1', {
      amount: '10',
      fromAssetCode: 'USDT',
      toAssetCode: 'VND',
    });

    expect(result).toMatchObject({
      feeAmount: '1215',
      feeAssetCode: 'VND',
      feeBps: 50,
      fromAmount: '10.00',
      fromAssetCode: 'USDT',
      grossReceiveAmount: '243000',
      rate: '24300',
      requestedAmount: '10.00',
      toAmount: '241785',
      toAssetCode: 'VND',
      totalDebit: '10.00',
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedMarkupVnd: 700,
        feeAmountMinor: 1215n,
        feeBps: 50,
        feeProfitVndMinor: 1215n,
        fromAmountMinor: 1000n,
        markupProfitVndMinor: 7000n,
        rate: '24300',
        realtimeRateVnd: '25000',
        toAmountMinor: 241785n,
        totalDebitMinor: 1000n,
      }),
    );
  });

  it('rounds VND destination fees up so the final VND receive favors the platform', async () => {
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const db = {
      insert: jest.fn().mockReturnValue({
        values: insertValues,
      }),
    };

    const service = new ExchangeService(
      {
        findByCode: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 2,
            code: 'USDT',
            id: 'asset-usdt',
          })
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        getUsdtPriceInVnd: jest.fn().mockResolvedValue('25000'),
      } as never,
      {
        db,
      } as never,
      {} as never,
      {} as never,
      {
        getExchangeUsdtToVndFeeBps: jest.fn().mockResolvedValue(125),
        getExchangeUsdtToVndMarkupVnd: jest.fn().mockResolvedValue(700),
        getExchangeVndToUsdtFeeBps: jest.fn(),
        getExchangeVndToUsdtMarkupVnd: jest.fn(),
      } as never,
      {} as never,
    );

    const result = await service.createQuote('user-1', {
      amount: '10.00',
      fromAssetCode: 'USDT',
      toAssetCode: 'VND',
    });

    expect(result).toMatchObject({
      feeAmount: '3038',
      feeAssetCode: 'VND',
      feeBps: 125,
      fromAmount: '10.00',
      fromAssetCode: 'USDT',
      grossReceiveAmount: '243000',
      rate: '24300',
      requestedAmount: '10.00',
      toAmount: '239962',
      toAssetCode: 'VND',
      totalDebit: '10.00',
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        feeAmountMinor: 3038n,
        feeProfitVndMinor: 3038n,
        fromAmountMinor: 1000n,
        totalDebitMinor: 1000n,
      }),
    );
  });

  it('executes exchange orders with one debit from the source wallet and one net credit to the target wallet', async () => {
    const quote = {
      appliedMarkupVnd: 1000,
      executedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      feeAmountMinor: 4n,
      feeProfitVndMinor: 1000n,
      fromAmountMinor: 100000n,
      fromAssetId: 'asset-vnd',
      id: 'quote-1',
      markupProfitVndMinor: 4000n,
      quoteId: 'quote-1',
      rate: '26000',
      realtimeRateVnd: '25000',
      toAmountMinor: 380n,
      toAssetId: 'asset-usdt',
      totalDebitMinor: 100000n,
      userId: 'user-1',
    };
    const selectForUpdate = jest.fn().mockResolvedValue([quote]);
    const tx = {
      insert: jest.fn().mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      }),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: selectForUpdate,
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const ledgerService = {
      creditAvailableAndTotal: jest.fn().mockResolvedValue(undefined),
      debitAvailableAndTotal: jest.fn().mockResolvedValue(undefined),
      lockWallet: jest
        .fn()
        .mockImplementation(async (_tx, walletId: string) =>
          walletId === 'wallet-vnd'
            ? {
                availableMinor: 100000n,
                id: 'wallet-vnd',
                pendingMinor: 0n,
                totalMinor: 100000n,
              }
            : {
                availableMinor: 0n,
                id: 'wallet-usdt',
                pendingMinor: 0n,
                totalMinor: 0n,
              },
        ),
    };
    const userNotificationsService = {
      createExchangeCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ExchangeService(
      {
        findById: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          })
          .mockResolvedValueOnce({
            assetPrecision: 6,
            code: 'USDT',
            id: 'asset-usdt',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<void>,
          ) => callback(tx),
        },
      } as never,
      {
        claim: jest.fn().mockResolvedValue(undefined),
      } as never,
      ledgerService as never,
      {} as never,
      {
        getWalletByUserAndAssetId: jest
          .fn()
          .mockResolvedValueOnce({ id: 'wallet-vnd' })
          .mockResolvedValueOnce({ id: 'wallet-usdt' }),
      } as never,
      userNotificationsService as never,
    );

    await service.execute('user-1', 'quote-1', 'idem-exchange');

    expect(ledgerService.debitAvailableAndTotal).toHaveBeenCalledTimes(1);
    expect(ledgerService.debitAvailableAndTotal).toHaveBeenNthCalledWith(
      1,
      tx,
      'wallet-vnd',
      100000n,
      'exchange_order',
      expect.any(String),
      'Đổi tiền - tổng trừ',
      'idem-exchange',
      expect.objectContaining({
        id: 'wallet-vnd',
      }),
    );
    expect(ledgerService.creditAvailableAndTotal).toHaveBeenCalledTimes(1);
    expect(ledgerService.creditAvailableAndTotal).toHaveBeenCalledWith(
      tx,
      'wallet-usdt',
      380n,
      'exchange_order',
      expect.any(String),
      'Đổi tiền - tiền nhận',
      'idem-exchange',
      expect.objectContaining({
        id: 'wallet-usdt',
      }),
    );
    expect(tx.insert().values).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedMarkupVnd: 1000,
        feeProfitVndMinor: 1000n,
        markupProfitVndMinor: 4000n,
        realtimeRateVnd: '25000',
      }),
    );
    expect(userNotificationsService.createExchangeCompleted).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        fromAssetCode: 'VND',
        referenceId: expect.any(String),
        toAmount: '0.000380',
        toAssetCode: 'USDT',
        totalDebit: '100000',
        userId: 'user-1',
      }),
    );
  });

  it('reverses a completed exchange by removing the exact credited amount and restoring the exact source debit', async () => {
    const exchangeOrder = {
      appliedMarkupVnd: 1000,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      feeAmountMinor: 4n,
      feeBps: 100,
      feeProfitVndMinor: 1000n,
      fromAmountMinor: 100000n,
      fromAssetId: 'asset-vnd',
      id: 'exchange-1',
      markupProfitVndMinor: 4000n,
      quoteId: 'quote-1',
      rate: '26000',
      realtimeRateVnd: '25000',
      reversedAt: null,
      reversedBy: null,
      status: 'completed',
      toAmountMinor: 380n,
      toAssetId: 'asset-usdt',
      totalDebitMinor: 100000n,
      userId: 'user-1',
    };
    const updateSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    });
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([exchangeOrder]),
          }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: updateSet,
      }),
    };
    const ledgerService = {
      creditAvailableAndTotal: jest.fn().mockResolvedValue(undefined),
      debitAvailableAndTotal: jest.fn().mockResolvedValue(undefined),
      lockWallet: jest
        .fn()
        .mockImplementation(async (_tx, walletId: string) =>
          walletId === 'wallet-vnd'
            ? {
                availableMinor: 0n,
                id: 'wallet-vnd',
                pendingMinor: 0n,
                totalMinor: 0n,
              }
            : {
                availableMinor: 380n,
                id: 'wallet-usdt',
                pendingMinor: 0n,
                totalMinor: 380n,
              },
        ),
    };
    const userNotificationsService = {
      createExchangeReversed: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ExchangeService(
      {
        findById: jest
          .fn()
          .mockResolvedValueOnce({
            assetPrecision: 0,
            code: 'VND',
            id: 'asset-vnd',
          })
          .mockResolvedValueOnce({
            assetPrecision: 6,
            code: 'USDT',
            id: 'asset-usdt',
          }),
      } as never,
      {
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {} as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<void>,
          ) => callback(tx),
        },
      } as never,
      {} as never,
      ledgerService as never,
      {} as never,
      {
        getWalletByUserAndAssetId: jest
          .fn()
          .mockResolvedValueOnce({ id: 'wallet-vnd' })
          .mockResolvedValueOnce({ id: 'wallet-usdt' }),
      } as never,
      userNotificationsService as never,
    );

    await expect(service.reverse('admin-1', 'exchange-1')).resolves.toEqual({
      success: true,
    });

    expect(ledgerService.debitAvailableAndTotal).toHaveBeenCalledWith(
      tx,
      'wallet-usdt',
      380n,
      'exchange_order',
      'exchange-1',
      'Khôi phục đổi tiền - thu hồi tiền nhận',
      undefined,
      expect.objectContaining({
        id: 'wallet-usdt',
      }),
    );
    expect(ledgerService.creditAvailableAndTotal).toHaveBeenCalledWith(
      tx,
      'wallet-vnd',
      100000n,
      'exchange_order',
      'exchange-1',
      'Khôi phục đổi tiền - hoàn lại tiền nguồn',
      undefined,
      expect.objectContaining({
        id: 'wallet-vnd',
      }),
    );
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        reversedAt: expect.any(Date),
        reversedBy: 'admin-1',
        status: 'reversed',
      }),
    );
    expect(userNotificationsService.createExchangeReversed).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        fromAssetCode: 'VND',
        referenceId: 'exchange-1',
        toAmount: '0.000380',
        toAssetCode: 'USDT',
        totalDebit: '100000',
        userId: 'user-1',
      }),
    );
  });

  it('refuses to reverse a completed exchange when the received asset balance is no longer sufficient', async () => {
    const exchangeOrder = {
      fromAssetId: 'asset-vnd',
      id: 'exchange-locked',
      status: 'completed',
      toAmountMinor: 380n,
      toAssetId: 'asset-usdt',
      totalDebitMinor: 100000n,
      userId: 'user-1',
    };
    const tx = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue([exchangeOrder]),
          }),
        }),
      }),
    };
    const service = new ExchangeService(
      {} as never,
      {} as never,
      {} as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<void>,
          ) => callback(tx),
        },
      } as never,
      {} as never,
      {
        lockWallet: jest
          .fn()
          .mockImplementation(async (_tx, walletId: string) =>
            walletId === 'wallet-usdt'
              ? {
                  availableMinor: 200n,
                  id: 'wallet-usdt',
                  pendingMinor: 0n,
                  totalMinor: 200n,
                }
              : {
                  availableMinor: 0n,
                  id: 'wallet-vnd',
                  pendingMinor: 0n,
                  totalMinor: 0n,
                },
          ),
      } as never,
      {} as never,
      {
        getWalletByUserAndAssetId: jest
          .fn()
          .mockResolvedValueOnce({ id: 'wallet-vnd' })
          .mockResolvedValueOnce({ id: 'wallet-usdt' }),
      } as never,
      {} as never,
    );

    await expect(service.reverse('admin-1', 'exchange-locked')).rejects.toThrow(
      ConflictException,
    );
  });

  it('applies admin exchange search on top of date-filtered results', async () => {
    const filteredRows = [
      {
        appliedMarkupVnd: 1000,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        feeAmountMinor: 1n,
        feeBps: 100,
        feeProfitVndMinor: 250n,
        fromAmountMinor: 26000n,
        fromAssetCode: 'VND',
        fromPrecision: 0,
        id: 'exchange-1',
        markupProfitVndMinor: 500n,
        rate: '26000',
        realtimeRateVnd: '25000',
        toAmountMinor: 100n,
        toAssetCode: 'USDT',
        toPrecision: 2,
        totalDebitMinor: 26000n,
        userEmail: 'alice@example.com',
        userId: 'user-1',
        userPhone: '0901234567',
      },
      {
        appliedMarkupVnd: 1000,
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        feeAmountMinor: 1n,
        feeBps: 100,
        feeProfitVndMinor: 250n,
        fromAmountMinor: 26000n,
        fromAssetCode: 'VND',
        fromPrecision: 0,
        id: 'exchange-2',
        markupProfitVndMinor: 500n,
        rate: '26000',
        realtimeRateVnd: '25000',
        toAmountMinor: 100n,
        toAssetCode: 'USDT',
        toPrecision: 2,
        totalDebitMinor: 26000n,
        userEmail: 'bob@example.com',
        userId: 'user-2',
        userPhone: '0987654321',
      },
    ];
    const where = jest.fn().mockResolvedValue(filteredRows);

    const service = new ExchangeService(
      {} as never,
      {} as never,
      {} as never,
      {
        db: {
          select: jest.fn().mockReturnValue({
            from: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                innerJoin: jest.fn().mockReturnValue({
                  innerJoin: jest.fn().mockReturnValue({
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
    );

    const result = await service.listForAdmin(
      {
        endDate: '2026-04-10',
        endExclusive: new Date('2026-04-10T17:00:00.000Z'),
        start: new Date('2026-04-09T17:00:00.000Z'),
        startDate: '2026-04-10',
      },
      '0901',
    );

    expect(where).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'exchange-1',
        userPhone: '0901234567',
      }),
    );
  });
});
