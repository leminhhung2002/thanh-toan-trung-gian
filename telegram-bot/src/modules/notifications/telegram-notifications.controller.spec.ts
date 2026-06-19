import {
  ADMIN_NOTIFICATION_VERSION,
  type AdminNotificationEvent,
} from '@nganluong/notification-contracts';
import type { RmqContext } from '@nestjs/microservices';
import { TelegramNotificationsController } from './telegram-notifications.controller';
import type { TelegramNotificationConsumerService } from './telegram-notification-consumer.service';
import type { TelegramNotificationsRmqPublisher } from './telegram-notifications-rmq.publisher';

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

describe('TelegramNotificationsController', () => {
  const consumerService = {
    handle: jest.fn(),
  } as unknown as jest.Mocked<TelegramNotificationConsumerService>;
  const publisher = {
    publishDead: jest.fn(),
    publishRetry: jest.fn(),
  } as unknown as jest.Mocked<TelegramNotificationsRmqPublisher>;
  const channelRef = {
    ack: jest.fn(),
  };
  const message = {
    properties: {
      headers: {
        'x-telegram-attempt': 3,
      },
    },
  };
  const context = {
    getChannelRef: jest.fn(() => channelRef),
    getMessage: jest.fn(() => message),
  } as unknown as RmqContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes RMQ-derived attempt and ack wiring into the consumer service', async () => {
    consumerService.handle.mockImplementation(async (_event, deliveryContext) => {
      deliveryContext.ack();
    });

    const controller = new TelegramNotificationsController(
      consumerService,
      publisher,
    );

    await controller.handleTelegramPending(buildEvent(), context);

    expect(consumerService.handle).toHaveBeenCalledWith(
      buildEvent(),
      expect.objectContaining({
        attempt: 3,
      }),
    );
    expect(channelRef.ack).toHaveBeenCalledWith(message);
  });

  it('wires retry and dead-letter publishing through the Nest RMQ publisher wrapper', async () => {
    consumerService.handle.mockImplementation(async (_event, deliveryContext) => {
      await deliveryContext.publishRetry(buildEvent(), 4, 'telegram timeout');
      await deliveryContext.publishDead(buildEvent(), 5, 'telegram timeout');
    });

    const controller = new TelegramNotificationsController(
      consumerService,
      publisher,
    );

    await controller.handleTelegramPending(buildEvent(), context);

    expect(publisher.publishRetry).toHaveBeenCalledWith(
      buildEvent(),
      4,
      'telegram timeout',
    );
    expect(publisher.publishDead).toHaveBeenCalledWith(
      buildEvent(),
      5,
      'telegram timeout',
    );
  });

  it('unwraps RMQ record payloads that arrive as pattern/data envelopes', async () => {
    consumerService.handle.mockImplementation(async (_event, deliveryContext) => {
      deliveryContext.ack();
    });

    const controller = new TelegramNotificationsController(
      consumerService,
      publisher,
    );

    await controller.handleTelegramPending(
      {
        data: JSON.stringify(buildEvent()),
        pattern: 'telegram.pending',
      } as unknown as AdminNotificationEvent,
      context,
    );

    expect(consumerService.handle).toHaveBeenCalledWith(
      buildEvent(),
      expect.objectContaining({
        attempt: 3,
      }),
    );
    expect(channelRef.ack).toHaveBeenCalledWith(message);
  });

  it('unwraps nested string and buffer payloads from RMQ transport', async () => {
    consumerService.handle.mockImplementation(async (_event, deliveryContext) => {
      deliveryContext.ack();
    });

    const controller = new TelegramNotificationsController(
      consumerService,
      publisher,
    );

    await controller.handleTelegramPending(
      {
        data: Buffer.from(JSON.stringify(buildEvent()), 'utf8'),
      } as unknown as AdminNotificationEvent,
      context,
    );

    expect(consumerService.handle).toHaveBeenCalledWith(
      buildEvent(),
      expect.objectContaining({
        attempt: 3,
      }),
    );
  });
});
