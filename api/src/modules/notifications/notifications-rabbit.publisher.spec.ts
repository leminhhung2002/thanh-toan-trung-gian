import {
  ADMIN_NOTIFICATION_VERSION,
  type AdminNotificationEvent,
} from '@nganluong/notification-contracts';
import type { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  NotificationsRabbitPublisher,
  type NotificationsRabbitOptions,
} from './notifications-rabbit.publisher';

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

describe('NotificationsRabbitPublisher', () => {
  const client = {
    connect: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(() => of(undefined)),
  } as unknown as jest.Mocked<ClientProxy>;
  const options: NotificationsRabbitOptions = {
    exchange: 'admin_notifications',
    routingKey: 'telegram.pending',
    url: 'amqp://127.0.0.1:5672',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes events through the Nest RMQ client using the configured routing key', async () => {
    const service = new NotificationsRabbitPublisher(client, options);

    await service.onApplicationBootstrap();
    await service.publish(buildEvent());

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.emit).toHaveBeenCalledWith(
      'telegram.pending',
      expect.any(Object),
    );
  });
});
