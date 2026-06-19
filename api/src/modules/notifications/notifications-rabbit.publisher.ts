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

export const NOTIFICATIONS_RABBIT_OPTIONS = Symbol(
  'NOTIFICATIONS_RABBIT_OPTIONS',
);

export const NOTIFICATIONS_RMQ_CLIENT = Symbol('NOTIFICATIONS_RMQ_CLIENT');

export type NotificationsRabbitOptions = {
  exchange: string;
  routingKey: string;
  url: string;
};

@Injectable()
export class NotificationsRabbitPublisher implements OnApplicationBootstrap {
  constructor(
    @Inject(NOTIFICATIONS_RMQ_CLIENT)
    private readonly client: ClientProxy,
    @Inject(NOTIFICATIONS_RABBIT_OPTIONS)
    private readonly options: NotificationsRabbitOptions,
  ) {}

  async onApplicationBootstrap() {
    await this.client.connect();
  }

  async publish(event: AdminNotificationEvent) {
    const record = new RmqRecordBuilder(event)
      .setOptions({
        persistent: true,
      })
      .build();

    await lastValueFrom(
      this.client
        .emit(this.options.routingKey, record)
        .pipe(defaultIfEmpty(undefined)),
    );
  }
}
