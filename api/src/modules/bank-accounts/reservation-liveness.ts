type ReservationLivenessInput = {
  expiresAt: Date;
  now?: Date;
  status: string;
};

function isExpired(expiresAt: Date, now: Date) {
  return expiresAt.getTime() <= now.getTime();
}

export function countReservationAsReservedUnconfirmed({
  expiresAt,
  now = new Date(),
  status,
}: ReservationLivenessInput) {
  return status === 'active' && !isExpired(expiresAt, now);
}

export function countReservationAsPendingReview({
  status,
}: ReservationLivenessInput) {
  return status === 'pending_review';
}

export function countReservationAsLive(input: ReservationLivenessInput) {
  return (
    countReservationAsReservedUnconfirmed(input) ||
    countReservationAsPendingReview(input)
  );
}
