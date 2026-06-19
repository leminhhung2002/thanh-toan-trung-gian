import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { AuditModule } from '../audit/audit.module';
import {
  AdminTelegramRuntimeConfigController,
  InternalTelegramRuntimeConfigController,
} from './telegram-runtime-config.controller';
import { TelegramConfigValidationGateway } from './telegram-config-validation.gateway';
import { TelegramRuntimeConfigInternalGuard } from './telegram-runtime-config-internal.guard';
import {
  DrizzleTelegramRuntimeConfigRepository,
} from './telegram-runtime-config.repository';
import {
  TELEGRAM_RUNTIME_CONFIG_SIGNAL_CLIENT,
  TELEGRAM_RUNTIME_CONFIG_SIGNAL_OPTIONS,
  TelegramRuntimeConfigSignalPublisher,
} from './telegram-runtime-config-signal.publisher';
import { TelegramRuntimeConfigService } from './telegram-runtime-config.service';

@Module({
  imports: [
    AuditModule,
    ClientsModule.registerAsync([
      {
        inject: [ConfigService],
        name: TELEGRAM_RUNTIME_CONFIG_SIGNAL_CLIENT,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            exchange: configService.get<string>(
              'RABBITMQ_NOTIFICATIONS_EXCHANGE',
              'admin_notifications',
            ),
            exchangeType: 'topic',
            persistent: true,
            queue: 'telegram_config_updates',
            queueOptions: {
              durable: true,
            },
            routingKey: configService.get<string>(
              'RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY',
              'telegram.config.updated',
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
  controllers: [
    AdminTelegramRuntimeConfigController,
    InternalTelegramRuntimeConfigController,
  ],
  providers: [
    TelegramConfigValidationGateway,
    TelegramRuntimeConfigInternalGuard,
    TelegramRuntimeConfigService,
    TelegramRuntimeConfigSignalPublisher,
    {
      provide: 'TelegramRuntimeConfigRepository',
      useClass: DrizzleTelegramRuntimeConfigRepository,
    },
    {
      provide: TELEGRAM_RUNTIME_CONFIG_SIGNAL_OPTIONS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        routingKey: configService.get<string>(
          'RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY',
          'telegram.config.updated',
        ),
      }),
    },
  ],
})
export class TelegramRuntimeConfigModule {}
