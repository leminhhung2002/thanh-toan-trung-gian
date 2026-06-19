import {
  ADMIN_NOTIFICATION_VERSION,
  type AdminNotificationEvent,
} from '@nganluong/notification-contracts';
import { TelegramNotificationConsumerService } from './telegram-notification-consumer.service';
import type { TelegramClientService } from '../telegram/telegram-client.service';
import { TelegramRuntimeConfigUnavailableError } from '../telegram/telegram-runtime-config.service';

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

describe('TelegramNotificationConsumerService', () => {
  const telegramClient: jest.Mocked<TelegramClientService> = {
    sendMessage: jest.fn(),
  } as unknown as jest.Mocked<TelegramClientService>;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('acks after Telegram accepts the message', async () => {
    const ack = jest.fn();
    const publishRetry = jest.fn();
    const publishDead = jest.fn();
    const service = new TelegramNotificationConsumerService(telegramClient, {
      maxAttempts: 5,
    });

    await service.handle(buildEvent(), {
      ack,
      attempt: 1,
      publishDead,
      publishRetry,
    });

    expect(telegramClient.sendMessage).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(publishRetry).not.toHaveBeenCalled();
    expect(publishDead).not.toHaveBeenCalled();
  });

  it('republishes to the retry queue and then acks when Telegram fails below the retry limit', async () => {
    const ack = jest.fn();
    const publishRetry = jest.fn();
    const publishDead = jest.fn();
    telegramClient.sendMessage.mockRejectedValue(new Error('telegram timeout'));
    const service = new TelegramNotificationConsumerService(telegramClient, {
      maxAttempts: 5,
    });

    await service.handle(buildEvent(), {
      ack,
      attempt: 1,
      publishDead,
      publishRetry,
    });

    expect(publishRetry).toHaveBeenCalledWith(buildEvent(), 2, 'telegram timeout');
    expect(publishDead).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('publishes to the dead queue and then acks when Telegram keeps failing past the retry limit', async () => {
    const ack = jest.fn();
    const publishRetry = jest.fn();
    const publishDead = jest.fn();
    telegramClient.sendMessage.mockRejectedValue(new Error('telegram timeout'));
    const service = new TelegramNotificationConsumerService(telegramClient, {
      maxAttempts: 5,
    });

    await service.handle(buildEvent(), {
      ack,
      attempt: 5,
      publishDead,
      publishRetry,
    });

    expect(publishDead).toHaveBeenCalledWith(buildEvent(), 5, 'telegram timeout');
    expect(publishRetry).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('republishes with the same attempt and acks when runtime config is unavailable', async () => {
    const ack = jest.fn();
    const publishRetry = jest.fn();
    const publishDead = jest.fn();
    telegramClient.sendMessage.mockRejectedValue(
      new TelegramRuntimeConfigUnavailableError(
        'Telegram runtime config is unavailable.',
      ),
    );
    const service = new TelegramNotificationConsumerService(telegramClient, {
      maxAttempts: 5,
    });

    await service.handle(buildEvent(), {
      ack,
      attempt: 4,
      publishDead,
      publishRetry,
    });

    expect(publishRetry).toHaveBeenCalledWith(
      buildEvent(),
      4,
      'Telegram runtime config is unavailable.',
    );
    expect(publishDead).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('does not consume retry budget when runtime config is unavailable at the retry limit', async () => {
    const ack = jest.fn();
    const publishRetry = jest.fn();
    const publishDead = jest.fn();
    telegramClient.sendMessage.mockRejectedValue(
      new TelegramRuntimeConfigUnavailableError(
        'Telegram runtime config is unavailable.',
      ),
    );
    const service = new TelegramNotificationConsumerService(telegramClient, {
      maxAttempts: 5,
    });

    await service.handle(buildEvent(), {
      ack,
      attempt: 5,
      publishDead,
      publishRetry,
    });

    expect(publishRetry).toHaveBeenCalledWith(
      buildEvent(),
      5,
      'Telegram runtime config is unavailable.',
    );
    expect(publishDead).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledTimes(1);
  });
});
