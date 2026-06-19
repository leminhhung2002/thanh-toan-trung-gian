import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import {
  ClientProxy,
  RmqRecordBuilder,
} from '@nestjs/microservices';
import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { defaultIfEmpty, lastValueFrom } from 'rxjs';

const ATTEMPT_HEADER = 'x-telegram-attempt';
const ERROR_HEADER = 'x-telegram-last-error';

export const TELEGRAM_NOTIFICATIONS_RETRY_CLIENT = Symbol(
  'TELEGRAM_NOTIFICATIONS_RETRY_CLIENT',
);
export const TELEGRAM_NOTIFICATIONS_DEAD_CLIENT = Symbol(
  'TELEGRAM_NOTIFICATIONS_DEAD_CLIENT',
);
export const TELEGRAM_NOTIFICATIONS_RMQ_OPTIONS = Symbol(
  'TELEGRAM_NOTIFICATIONS_RMQ_OPTIONS',
);

export type TelegramNotificationsRmqOptions = {
  routingKey: string;
};

@Injectable()
export class TelegramNotificationsRmqPublisher
  implements OnApplicationBootstrap
{
  constructor(
    @Inject(TELEGRAM_NOTIFICATIONS_RETRY_CLIENT)
    private readonly retryClient: ClientProxy,
    @Inject(TELEGRAM_NOTIFICATIONS_DEAD_CLIENT)
    private readonly deadClient: ClientProxy,
    @Inject(TELEGRAM_NOTIFICATIONS_RMQ_OPTIONS)
    private readonly options: TelegramNotificationsRmqOptions,
  ) {}

  async onApplicationBootstrap() {
    await Promise.all([this.retryClient.connect(), this.deadClient.connect()]);
  }

  publishRetry(
    event: AdminNotificationEvent,
    attempt: number,
    errorMessage: string,
  ) {
    return this.publish(this.retryClient, event, {
      [ATTEMPT_HEADER]: String(attempt),
      [ERROR_HEADER]: errorMessage,
    });
  }

  publishDead(
    event: AdminNotificationEvent,
    attempt: number,
    errorMessage: string,
  ) {
    return this.publish(this.deadClient, event, {
      [ATTEMPT_HEADER]: String(attempt),
      [ERROR_HEADER]: errorMessage,
    });
  }

  private async publish(
    client: ClientProxy,
    event: AdminNotificationEvent,
    headers: Record<string, string>,
  ) {
    const record = new RmqRecordBuilder(event)
      .setOptions({
        headers,
        persistent: true,
      })
      .build();

    await lastValueFrom(
      client.emit(this.options.routingKey, record).pipe(defaultIfEmpty(undefined)),
    );
  }
}
