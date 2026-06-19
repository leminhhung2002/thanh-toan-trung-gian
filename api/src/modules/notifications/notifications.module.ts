import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS,
  NotificationOutboxPublisherService,
} from './notification-outbox-publisher.service';
import { NotificationOutboxPublisherRunner } from './notification-outbox-publisher.runner';
import {
  DrizzleNotificationOutboxRepository,
} from './notification-outbox.repository';
import { NotificationOutboxService } from './notification-outbox.service';
import {
  NOTIFICATIONS_RMQ_CLIENT,
  NOTIFICATIONS_RABBIT_OPTIONS,
  NotificationsRabbitPublisher,
} from './notifications-rabbit.publisher';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        inject: [ConfigService],
        name: NOTIFICATIONS_RMQ_CLIENT,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            exchange: configService.get<string>(
              'RABBITMQ_NOTIFICATIONS_EXCHANGE',
              'admin_notifications',
            ),
            exchangeType: 'topic',
            persistent: true,
            queue: 'telegram_notifications',
            queueOptions: {
              durable: true,
            },
            routingKey: configService.get<string>(
              'RABBITMQ_NOTIFICATIONS_ROUTING_KEY',
              'telegram.pending',
            ),
            urls: [
              configService.get<string>(
                'RABBITMQ_URL',
                'amqp://127.0.0.1:5672',
              ),
            ],
            wildcards: true,
          },
        }),
      },
    ]),
  ],
  providers: [
    NotificationOutboxService,
    NotificationOutboxPublisherService,
    NotificationOutboxPublisherRunner,
    NotificationsRabbitPublisher,
    {
      provide: 'NotificationOutboxRepository',
      useClass: DrizzleNotificationOutboxRepository,
    },
    {
      provide: NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        batchSize: configService.get<number>('NOTIFICATION_OUTBOX_BATCH_SIZE', 20),
        maxAttempts: configService.get<number>('NOTIFICATION_OUTBOX_MAX_ATTEMPTS', 5),
        retryBaseDelayMs: configService.get<number>(
          'NOTIFICATION_OUTBOX_POLL_INTERVAL_MS',
          5000,
        ),
      }),
    },
    {
      provide: NOTIFICATIONS_RABBIT_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        exchange: configService.get<string>(
          'RABBITMQ_NOTIFICATIONS_EXCHANGE',
          'admin_notifications',
        ),
        routingKey: configService.get<string>(
          'RABBITMQ_NOTIFICATIONS_ROUTING_KEY',
          'telegram.pending',
        ),
        url: configService.get<string>(
          'RABBITMQ_URL',
          'amqp://127.0.0.1:5672',
        ),
      }),
    },
  ],
  exports: [NotificationOutboxService],
})
export class NotificationsModule {}
