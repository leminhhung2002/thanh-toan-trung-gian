import type { TelegramConfigUpdatedEvent } from '@nganluong/notification-contracts';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { defaultIfEmpty, lastValueFrom } from 'rxjs';
import { buildTelegramConfigUpdatedEvent } from './telegram-runtime-config-events';

export const TELEGRAM_RUNTIME_CONFIG_SIGNAL_CLIENT = Symbol(
  'TELEGRAM_RUNTIME_CONFIG_SIGNAL_CLIENT',
);
export const TELEGRAM_RUNTIME_CONFIG_SIGNAL_OPTIONS = Symbol(
  'TELEGRAM_RUNTIME_CONFIG_SIGNAL_OPTIONS',
);

export type TelegramRuntimeConfigSignalOptions = {
  routingKey: string;
};

@Injectable()
export class TelegramRuntimeConfigSignalPublisher
  implements OnApplicationBootstrap
{
  constructor(
    @Inject(TELEGRAM_RUNTIME_CONFIG_SIGNAL_CLIENT)
    private readonly client: ClientProxy,
    @Inject(TELEGRAM_RUNTIME_CONFIG_SIGNAL_OPTIONS)
    private readonly options: TelegramRuntimeConfigSignalOptions,
  ) {}

  async onApplicationBootstrap() {
    await this.client.connect();
  }

  async publishUpdated(input: { updatedAt: Date; version: number }) {
    const event = buildTelegramConfigUpdatedEvent(input);
    await this.publish(event);
  }

  private async publish(event: TelegramConfigUpdatedEvent) {
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
