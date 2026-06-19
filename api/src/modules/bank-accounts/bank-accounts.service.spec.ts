import { BankAccountsService } from './bank-accounts.service';

describe('BankAccountsService', () => {
  it('returns the all-time approved deposit total for each bank account', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date());
    const bankRows = [
      {
        accountName: 'NGAN LUONG',
        accountNumber: '123456789',
        bankCode: '970436',
        bankName: 'Vietcombank',
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        dailyLimitMinor: 1_000_000n,
        id: 'bank-1',
        isActive: true,
        priority: 1,
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        usedTodayMinor: 150_000n,
      },
      {
        accountName: 'NGAN LUONG 2',
        accountNumber: '987654321',
        bankCode: '970418',
        bankName: 'BIDV',
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        dailyLimitMinor: 2_000_000n,
        id: 'bank-2',
        isActive: true,
        priority: 2,
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        usedTodayMinor: 50_000n,
      },
    ];
    const reservationRows = [
      {
        amountMinor: 120_000n,
        bankAccountId: 'bank-1',
        expiresAt: new Date('2026-04-13T10:00:00.000Z'),
        status: 'active',
      },
      {
        amountMinor: 80_000n,
        bankAccountId: 'bank-1',
        expiresAt: new Date('2026-04-13T10:00:00.000Z'),
        status: 'pending_review',
      },
    ];
    const pendingDepositRows = [
      { bankAccountId: 'bank-1' },
      { bankAccountId: 'bank-1' },
      { bankAccountId: 'bank-2' },
    ];
    const approvedDepositRows = [
      { amountMinor: 400_000n, bankAccountId: 'bank-1' },
      { amountMinor: 600_000n, bankAccountId: 'bank-1' },
      { amountMinor: 750_000n, bankAccountId: 'bank-2' },
      { amountMinor: 999_999n, bankAccountId: null },
    ];

    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                for: jest.fn().mockResolvedValue([{ value: today }]),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(bankRows),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(reservationRows),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(pendingDepositRows),
          }),
        })
        .mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(approvedDepositRows),
          }),
        }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    const service = new BankAccountsService(
      {
        log: jest.fn().mockResolvedValue(undefined),
        logWithTransaction: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        db: {
          transaction: async (
            callback: (transaction: typeof tx) => Promise<unknown>,
          ) => callback(tx),
        },
      } as never,
    );

    const result = await service.listForAdmin();

    expect(result).toEqual([
      expect.objectContaining({
        approvedTotal: '1000000',
        canDelete: false,
        id: 'bank-1',
        pendingDepositCount: 2,
      }),
      expect.objectContaining({
        approvedTotal: '750000',
        canDelete: false,
        id: 'bank-2',
        pendingDepositCount: 1,
      }),
    ]);
  });
});
