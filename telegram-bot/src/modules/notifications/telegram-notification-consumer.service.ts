import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TelegramGateway } from '../telegram/telegram-gateway';
import { formatTelegramAdminAlert } from '../telegram/telegram-message-formatter';
import { TelegramRuntimeConfigUnavailableError } from '../telegram/telegram-runtime-config.service';

export const TELEGRAM_NOTIFICATION_CONSUMER_OPTIONS = Symbol(
  'TELEGRAM_NOTIFICATION_CONSUMER_OPTIONS',
);

export type TelegramNotificationConsumerOptions = {
  maxAttempts: number;
};

export type TelegramNotificationDeliveryContext = {
  ack: () => void;
  attempt: number;
  publishDead: (
    event: AdminNotificationEvent,
    attempt: number,
    errorMessage: string,
  ) => Promise<void>;
  publishRetry: (
    event: AdminNotificationEvent,
    attempt: number,
    errorMessage: string,
  ) => Promise<void>;
};

@Injectable()
export class TelegramNotificationConsumerService {
  private readonly options: TelegramNotificationConsumerOptions;
  private readonly logger = new Logger(TelegramNotificationConsumerService.name);

  constructor(
    private readonly telegramGateway: TelegramGateway,
    @Optional()
    @Inject(TELEGRAM_NOTIFICATION_CONSUMER_OPTIONS)
    options?: TelegramNotificationConsumerOptions,
  ) {
    this.options = options ?? { maxAttempts: 5 };
  }

  async handle(
    event: AdminNotificationEvent,
    context: TelegramNotificationDeliveryContext,
  ) {
    try {
      await this.telegramGateway.sendMessage(formatTelegramAdminAlert(event));
      context.ack();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown Telegram send failure';

      if (error instanceof TelegramRuntimeConfigUnavailableError) {
        this.logger.warn(
          `Telegram runtime config unavailable; retrying without consuming retry budget: ${errorMessage}`,
        );
        await context.publishRetry(event, context.attempt, errorMessage);
        context.ack();
        return;
      }

      if (context.attempt >= this.options.maxAttempts) {
        await context.publishDead(event, context.attempt, errorMessage);
      } else {
        await context.publishRetry(event, context.attempt + 1, errorMessage);
      }

      context.ack();
    }
  }
}
