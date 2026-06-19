import {
  countReservationAsPendingReview,
  countReservationAsReservedUnconfirmed,
  countReservationAsLive,
} from './reservation-liveness';

describe('reservation-liveness', () => {
  const now = new Date('2026-04-04T10:00:00.000Z');

  it('counts only active and unexpired reservations as reserved unconfirmed', () => {
    expect(
      countReservationAsReservedUnconfirmed({
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        now,
        status: 'active',
      }),
    ).toBe(true);

    expect(
      countReservationAsReservedUnconfirmed({
        expiresAt: new Date('2026-04-04T09:59:59.000Z'),
        now,
        status: 'active',
      }),
    ).toBe(false);

    expect(
      countReservationAsReservedUnconfirmed({
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        now,
        status: 'pending_review',
      }),
    ).toBe(false);
  });

  it('counts only pending-review reservations in the pending-review bucket', () => {
    expect(
      countReservationAsPendingReview({
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        now,
        status: 'pending_review',
      }),
    ).toBe(true);

    expect(
      countReservationAsPendingReview({
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        now,
        status: 'active',
      }),
    ).toBe(false);
  });

  it('treats only active-unexpired and pending-review reservations as live', () => {
    expect(
      countReservationAsLive({
        expiresAt: new Date('2026-04-04T10:05:00.000Z'),
        now,
        status: 'active',
      }),
    ).toBe(true);

    expect(
      countReservationAsLive({
        expiresAt: new Date('2026-04-04T09:59:59.000Z'),
        now,
        status: 'active',
      }),
    ).toBe(false);

    expect(
      countReservationAsLive({
        expiresAt: new Date('2026-04-04T09:59:59.000Z'),
        now,
        status: 'pending_review',
      }),
    ).toBe(true);
  });
});
