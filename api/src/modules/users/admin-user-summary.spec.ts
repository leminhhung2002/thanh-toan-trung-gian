import { buildAdminUserSummary } from './admin-user-summary';

describe('buildAdminUserSummary', () => {
  it('returns zeroed balances and totals when the user has no wallet or totals rows', () => {
    expect(
      buildAdminUserSummary({
        depositTotals: [],
        roleRows: [],
        user: {
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          email: 'user@example.com',
          id: 'user-1',
          phone: null,
          telegram: null,
        },
        walletRows: [],
        withdrawalTotals: [],
      }),
    ).toMatchObject({
      balances: {
        usdt: { available: '0.00', pending: '0.00', total: '0.00' },
        vnd: { available: '0', pending: '0', total: '0' },
      },
      totals: {
        totalDepositUsdt: '0.00',
        totalDepositVnd: '0',
        totalWithdrawUsdt: '0.00',
        totalWithdrawVnd: '0',
      },
    });
  });

  it('aggregates wallet balances, roles and asset totals for a single admin user row', () => {
    expect(
      buildAdminUserSummary({
        depositTotals: [
          { amountMinor: 125_000n, assetCode: 'VND', precision: 0, userId: 'user-1' },
          { amountMinor: 250n, assetCode: 'USDT', precision: 2, userId: 'user-1' },
        ],
        roleRows: [{ roleCode: 'admin', userId: 'user-1' }],
        user: {
          createdAt: new Date('2026-04-04T10:00:00.000Z'),
          email: 'user@example.com',
          id: 'user-1',
          phone: '0909',
          telegram: '@user',
        },
        walletRows: [
          {
            assetCode: 'VND',
            availableMinor: 50_000n,
            pendingMinor: 10_000n,
            precision: 0,
            totalMinor: 60_000n,
            userId: 'user-1',
          },
          {
            assetCode: 'USDT',
            availableMinor: 125n,
            pendingMinor: 25n,
            precision: 2,
            totalMinor: 150n,
            userId: 'user-1',
          },
        ],
        withdrawalTotals: [
          { amountMinor: 20_000n, assetCode: 'VND', precision: 0, userId: 'user-1' },
        ],
      }),
    ).toMatchObject({
      balances: {
        usdt: { available: '1.25', pending: '0.25', total: '1.50' },
        vnd: { available: '50000', pending: '10000', total: '60000' },
      },
      roles: ['admin'],
      totals: {
        totalDepositUsdt: '2.50',
        totalDepositVnd: '125000',
        totalWithdrawUsdt: '0.00',
        totalWithdrawVnd: '20000',
      },
    });
  });
});
