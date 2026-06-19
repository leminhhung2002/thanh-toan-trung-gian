import { buildReservationBucketTotals, pickBankAccountForAmount } from './bank-account-capacity';

describe('bank account capacity helpers', () => {
  it('rolls active and pending-review reservations into the correct buckets', () => {
    const buckets = buildReservationBucketTotals([
      {
        amountMinor: 100_000n,
        bankAccountId: 'bank-a',
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        status: 'active',
      },
      {
        amountMinor: 300_000n,
        bankAccountId: 'bank-a',
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        status: 'pending_review',
      },
      {
        amountMinor: 200_000n,
        bankAccountId: 'bank-b',
        expiresAt: new Date('2026-04-04T09:00:00.000Z'),
        status: 'active',
      },
    ], new Date('2026-04-04T10:00:00.000Z'));

    expect(buckets.reservedUnconfirmed.get('bank-a')).toBe(100_000n);
    expect(buckets.reservedPendingReview.get('bank-a')).toBe(300_000n);
    expect(buckets.liveReservationCount.get('bank-a')).toBe(2);
    expect(buckets.liveReservationCount.has('bank-b')).toBe(false);
  });

  it('selects the first bank account that still has enough remaining capacity', () => {
    const selected = pickBankAccountForAmount(
      [
        {
          createdAt: new Date('2026-04-04T09:00:00.000Z'),
          dailyLimitMinor: 500_000n,
          id: 'bank-a',
          priority: 1,
          usedTodayMinor: 250_000n,
        },
        {
          createdAt: new Date('2026-04-04T09:01:00.000Z'),
          dailyLimitMinor: 1_000_000n,
          id: 'bank-b',
          priority: 2,
          usedTodayMinor: 100_000n,
        },
      ],
      {
        liveReservationCount: new Map(),
        reservedPendingReview: new Map([['bank-a', 150_000n]]),
        reservedUnconfirmed: new Map([['bank-a', 100_000n]]),
      },
      200_000n,
    );

    expect(selected?.id).toBe('bank-b');
  });
});
