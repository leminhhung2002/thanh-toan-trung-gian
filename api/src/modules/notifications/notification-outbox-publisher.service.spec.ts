import {
  ADMIN_NOTIFICATION_VERSION,
  type AdminNotificationEvent,
} from '@nganluong/notification-contracts';
import { NotificationOutboxPublisherService } from './notification-outbox-publisher.service';
import type {
  NotificationOutboxRecord,
  NotificationOutboxRepository,
} from './notification-outbox.repository';
import type { NotificationsRabbitPublisher } from './notifications-rabbit.publisher';

function buildEvent(): AdminNotificationEvent {
  return {
    eventType: 'deposit.pending.created',
    occurredAt: '2026-04-04T10:00:00.000Z',
    payload: {
      amount: '100000',
      assetCode: 'VND',
      createdAt: '2026-04-04T10:00:00.000Z',
      depositRequestId: 'dep-1',
      destinationRef: 'NL dep-1',
      externalReference: null,
      method: 'bank_transfer',
      note: null,
      proofUrl: null,
      selectedBankAccount: null,
      status: 'pending',
      userEmail: 'user@example.com',
      userId: 'user-1',
    },
    version: ADMIN_NOTIFICATION_VERSION,
  };
}

function buildRecord(
  overrides: Partial<NotificationOutboxRecord> = {},
): NotificationOutboxRecord {
  return {
    attemptCount: 0,
    entityId: 'dep-1',
    entityType: 'deposit_request',
    eventType: 'deposit.pending.created',
    id: 'outbox-1',
    lastError: null,
    nextAttemptAt: new Date('2026-04-04T10:00:00.000Z'),
    payload: buildEvent(),
    status: 'pending',
    ...overrides,
  };
}

describe('NotificationOutboxPublisherService', () => {
  const outboxRepository: jest.Mocked<NotificationOutboxRepository> = {
    listReadyBatch: jest.fn(),
    markPublished: jest.fn(),
    markRetryResult: jest.fn(),
  };
  const publisher: jest.Mocked<NotificationsRabbitPublisher> = {
    publish: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('marks a row as published after RabbitMQ accepts the event', async () => {
    const now = new Date('2026-04-04T10:00:00.000Z');
    outboxRepository.listReadyBatch.mockResolvedValue([buildRecord()]);

    const service = new NotificationOutboxPublisherService(
      outboxRepository,
      publisher,
      {
        batchSize: 10,
        maxAttempts: 5,
        retryBaseDelayMs: 1000,
      },
    );

    await service.publishPendingBatch(now);

    expect(publisher.publish).toHaveBeenCalledWith(buildEvent());
    expect(outboxRepository.markPublished).toHaveBeenCalledWith(
      'outbox-1',
      expect.any(Date),
    );
    expect(outboxRepository.markRetryResult).not.toHaveBeenCalled();
  });

  it('keeps the row pending with a later nextAttemptAt when publish fails below the retry limit', async () => {
    const now = new Date('2026-04-04T10:00:00.000Z');
    outboxRepository.listReadyBatch.mockResolvedValue([
      buildRecord({ attemptCount: 1 }),
    ]);
    publisher.publish.mockRejectedValue(new Error('broker unavailable'));

    const service = new NotificationOutboxPublisherService(
      outboxRepository,
      publisher,
      {
        batchSize: 10,
        maxAttempts: 5,
        retryBaseDelayMs: 1000,
      },
    );

    await service.publishPendingBatch(now);

    expect(outboxRepository.markRetryResult).toHaveBeenCalledWith('outbox-1', {
      attemptCount: 2,
      lastError: 'broker unavailable',
      nextAttemptAt: new Date('2026-04-04T10:00:04.000Z'),
      status: 'pending',
    });
  });

  it('marks the row as dead when the retry limit is exhausted', async () => {
    const now = new Date('2026-04-04T10:00:00.000Z');
    outboxRepository.listReadyBatch.mockResolvedValue([
      buildRecord({ attemptCount: 4 }),
    ]);
    publisher.publish.mockRejectedValue(new Error('broker unavailable'));

    const service = new NotificationOutboxPublisherService(
      outboxRepository,
      publisher,
      {
        batchSize: 10,
        maxAttempts: 5,
        retryBaseDelayMs: 1000,
      },
    );

    await service.publishPendingBatch(now);

    expect(outboxRepository.markRetryResult).toHaveBeenCalledWith('outbox-1', {
      attemptCount: 5,
      lastError: 'broker unavailable',
      nextAttemptAt: new Date('2026-04-04T10:00:16.000Z'),
      status: 'dead',
    });
  });
});
