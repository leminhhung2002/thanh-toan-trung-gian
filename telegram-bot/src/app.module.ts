import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { validateEnv } from './config/env.validation';
import {
  TELEGRAM_NOTIFICATION_CONSUMER_OPTIONS,
  TelegramNotificationConsumerService,
} from './modules/notifications/telegram-notification-consumer.service';
import { TelegramNotificationsController } from './modules/notifications/telegram-notifications.controller';
import {
  TELEGRAM_NOTIFICATIONS_DEAD_CLIENT,
  TELEGRAM_NOTIFICATIONS_RETRY_CLIENT,
  TELEGRAM_NOTIFICATIONS_RMQ_OPTIONS,
  TelegramNotificationsRmqPublisher,
} from './modules/notifications/telegram-notifications-rmq.publisher';
import {
  TelegramClientService,
} from './modules/telegram/telegram-client.service';
import { TelegramApiClientFactory } from './modules/telegram/telegram-api-client.factory';
import { TelegramGateway } from './modules/telegram/telegram-gateway';
import { TelegramRuntimeConfigService } from './modules/telegram/telegram-runtime-config.service';
import { TelegramRuntimeConfigSignalConsumerService } from './modules/telegram/telegram-runtime-config-signal-consumer.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validate: validateEnv,
    }),
    ClientsModule.registerAsync([
      {
        inject: [ConfigService],
        name: TELEGRAM_NOTIFICATIONS_RETRY_CLIENT,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            persistent: true,
            queue: configService.get<string>(
              'RABBITMQ_NOTIFICATIONS_RETRY_QUEUE',
              'telegram_notifications_retry',
            ),
            queueOptions: {
              arguments: {
                'x-dead-letter-exchange': configService.get<string>(
                  'RABBITMQ_NOTIFICATIONS_EXCHANGE',
                  'admin_notifications',
                ),
                'x-dead-letter-routing-key': configService.get<string>(
                  'RABBITMQ_NOTIFICATIONS_ROUTING_KEY',
                  'telegram.pending',
                ),
                'x-message-ttl': 15000,
              },
              durable: true,
            },
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://127.0.0.1:5672',
              ),
            ],
          },
        }),
      },
      {
        inject: [ConfigService],
        name: TELEGRAM_NOTIFICATIONS_DEAD_CLIENT,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            persistent: true,
            queue: configService.get<string>(
              'RABBITMQ_NOTIFICATIONS_DEAD_QUEUE',
              'telegram_notifications_dead',
            ),
            queueOptions: {
              durable: true,
            },
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://127.0.0.1:5672',
              ),
            ],
          },
        }),
      },
    ]),
  ],
  controllers: [TelegramNotificationsController],
  providers: [
    TelegramApiClientFactory,
    TelegramClientService,
    {
      provide: TelegramGateway,
      useExisting: TelegramClientService,
    },
    TelegramNotificationConsumerService,
    TelegramNotificationsRmqPublisher,
    TelegramRuntimeConfigService,
    TelegramRuntimeConfigSignalConsumerService,
    {
      provide: TELEGRAM_NOTIFICATION_CONSUMER_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        maxAttempts: configService.get<number>('TELEGRAM_SEND_MAX_ATTEMPTS', 5),
      }),
    },
    {
      provide: TELEGRAM_NOTIFICATIONS_RMQ_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        routingKey: configService.get<string>(
          'RABBITMQ_NOTIFICATIONS_ROUTING_KEY',
          'telegram.pending',
        ),
      }),
    },
  ],
})
export class AppModule {}
