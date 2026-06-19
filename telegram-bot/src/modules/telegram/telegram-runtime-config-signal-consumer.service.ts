import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type AmqpConnectionManager, type ChannelWrapper } from 'amqp-connection-manager';
import type { TelegramConfigUpdatedEvent } from '@nganluong/notification-contracts';
import { TelegramRuntimeConfigService } from './telegram-runtime-config.service';

type ConfirmChannelLike = {
  ack: (message: unknown) => void;
  assertExchange: (
    exchange: string,
    type: string,
    options: { durable: boolean },
  ) => Promise<unknown>;
  assertQueue: (
    queue: string,
    options: { durable: boolean },
  ) => Promise<unknown>;
  bindQueue: (
    queue: string,
    exchange: string,
    routingKey: string,
  ) => Promise<unknown>;
  consume: (
    queue: string,
    onMessage: (message: unknown) => void,
  ) => Promise<unknown>;
};

@Injectable()
export class TelegramRuntimeConfigSignalConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    TelegramRuntimeConfigSignalConsumerService.name,
  );
  private channel: ChannelWrapper | null = null;
  private connection: AmqpConnectionManager | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly runtimeConfigService: TelegramRuntimeConfigService,
  ) {}

  async onModuleInit() {
    const url = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://127.0.0.1:5672',
    );
    const exchange = this.configService.get<string>(
      'RABBITMQ_NOTIFICATIONS_EXCHANGE',
      'admin_notifications',
    );
    const queue = this.configService.get<string>(
      'RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE',
      'telegram_config_updates',
    );
    const routingKey = this.configService.get<string>(
      'RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY',
      'telegram.config.updated',
    );

    this.connection = connect([url]);
    this.channel = this.connection.createChannel({
      setup: async (channel: ConfirmChannelLike) => {
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, routingKey);
        await channel.consume(queue, (message) => {
          void this.handleMessage(channel, message);
        });
      },
    });
  }

  async onModuleDestroy() {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }

    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
  }

  private async handleMessage(
    channel: ConfirmChannelLike,
    message: unknown,
  ) {
    if (!message) {
      return;
    }

    try {
      const body =
        typeof message === 'object' &&
        message !== null &&
        'content' in message &&
        (message as { content?: Buffer }).content
          ? (message as { content: Buffer }).content.toString('utf8')
          : '';
      const payload = JSON.parse(body) as
        | TelegramConfigUpdatedEvent
        | { data?: TelegramConfigUpdatedEvent };
      const event =
        'data' in payload && payload.data ? payload.data : payload;

      if ('eventType' in event && event.eventType === 'telegram.config.updated') {
        await this.runtimeConfigService.refreshActiveConfig('signal');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to apply Telegram runtime config signal: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } finally {
      channel.ack(message);
    }
  }
}
