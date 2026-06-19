import {
  countReservationAsLive,
  countReservationAsPendingReview,
  countReservationAsReservedUnconfirmed,
} from './reservation-liveness';

type ReservationRow = {
  amountMinor: bigint;
  bankAccountId: string;
  expiresAt: Date;
  status: string;
};

type BankAccountCapacityRow = {
  createdAt: Date;
  dailyLimitMinor: bigint;
  id: string;
  priority: number;
  usedTodayMinor: bigint;
};

export function buildReservationBucketTotals(
  rows: ReservationRow[],
  now = new Date(),
) {
  const reservedUnconfirmed = new Map<string, bigint>();
  const reservedPendingReview = new Map<string, bigint>();
  const liveReservationCount = new Map<string, number>();

  for (const row of rows) {
    if (
      countReservationAsReservedUnconfirmed({
        expiresAt: row.expiresAt,
        now,
        status: row.status,
      })
    ) {
      reservedUnconfirmed.set(
        row.bankAccountId,
        (reservedUnconfirmed.get(row.bankAccountId) ?? 0n) + row.amountMinor,
      );
    }

    if (
      countReservationAsPendingReview({
        expiresAt: row.expiresAt,
        now,
        status: row.status,
      })
    ) {
      reservedPendingReview.set(
        row.bankAccountId,
        (reservedPendingReview.get(row.bankAccountId) ?? 0n) + row.amountMinor,
      );
    }

    if (
      countReservationAsLive({
        expiresAt: row.expiresAt,
        now,
        status: row.status,
      })
    ) {
      liveReservationCount.set(
        row.bankAccountId,
        (liveReservationCount.get(row.bankAccountId) ?? 0) + 1,
      );
    }
  }

  return {
    liveReservationCount,
    reservedPendingReview,
    reservedUnconfirmed,
  };
}

export function getRemainingBankAccountCapacity<T extends BankAccountCapacityRow>(
  bankAccount: T,
  reservationBuckets: ReturnType<typeof buildReservationBucketTotals>,
) {
  const reservedMinor =
    (reservationBuckets.reservedUnconfirmed.get(bankAccount.id) ?? 0n) +
    (reservationBuckets.reservedPendingReview.get(bankAccount.id) ?? 0n);

  return bankAccount.dailyLimitMinor - bankAccount.usedTodayMinor - reservedMinor;
}

export function pickBankAccountForAmount<T extends BankAccountCapacityRow>(
  rows: T[],
  reservationBuckets: ReturnType<typeof buildReservationBucketTotals>,
  amountMinor: bigint,
) {
  return rows.find(
    (row) => getRemainingBankAccountCapacity(row, reservationBuckets) >= amountMinor,
  );
}
