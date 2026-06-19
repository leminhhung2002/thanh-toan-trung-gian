import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import { Controller } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';
import { TelegramNotificationConsumerService } from './telegram-notification-consumer.service';
import { TelegramNotificationsRmqPublisher } from './telegram-notifications-rmq.publisher';

const ATTEMPT_HEADER = 'x-telegram-attempt';

function isAdminNotificationEvent(value: unknown): value is AdminNotificationEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eventType' in value &&
    'payload' in value &&
    'occurredAt' in value
  );
}

function normalizeAdminNotificationEvent(input: unknown): AdminNotificationEvent {
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
    return normalizeAdminNotificationEvent(input.toString('utf8'));
  }

  if (typeof input === 'string') {
    return normalizeAdminNotificationEvent(JSON.parse(input));
  }

  if (isAdminNotificationEvent(input)) {
    return input;
  }

  if (
    typeof input === 'object' &&
    input !== null &&
    'data' in input
  ) {
    const rawData = input.data;

    return normalizeAdminNotificationEvent(rawData);
  }

  throw new Error('Invalid Telegram notification payload');
}

@Controller()
export class TelegramNotificationsController {
  constructor(
    private readonly consumerService: TelegramNotificationConsumerService,
    private readonly publisher: TelegramNotificationsRmqPublisher,
  ) {}

  @EventPattern('telegram.pending')
  async handleTelegramPending(
    @Payload() event: AdminNotificationEvent,
    @Ctx() context: RmqContext,
  ) {
    const normalizedEvent = normalizeAdminNotificationEvent(event);
    const channel = context.getChannelRef();
    const message = context.getMessage();
    const rawAttempt = message.properties.headers?.[ATTEMPT_HEADER];
    const parsedAttempt =
      typeof rawAttempt === 'number'
        ? rawAttempt
        : Number.parseInt(String(rawAttempt ?? ''), 10);
    const attempt =
      Number.isFinite(parsedAttempt) && parsedAttempt > 0
        ? parsedAttempt
        : 1;

    await this.consumerService.handle(normalizedEvent, {
      ack: () => {
        channel.ack(message);
      },
      attempt,
      publishDead: (payload, currentAttempt, errorMessage) =>
        this.publisher.publishDead(payload, currentAttempt, errorMessage),
      publishRetry: (payload, nextAttempt, errorMessage) =>
        this.publisher.publishRetry(payload, nextAttempt, errorMessage),
    });
  }
}
