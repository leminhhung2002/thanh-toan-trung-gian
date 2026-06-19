import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  type AsyncMicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<AsyncMicroserviceOptions>(
    AppModule,
    {
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: Transport.RMQ,
        options: {
          exchange: configService.get<string>(
            'RABBITMQ_NOTIFICATIONS_EXCHANGE',
            'admin_notifications',
          ),
          exchangeType: 'topic',
          noAck: false,
          persistent: true,
          prefetchCount: 1,
          queue: configService.get<string>(
            'RABBITMQ_NOTIFICATIONS_QUEUE',
            'telegram_notifications',
          ),
          queueOptions: {
            durable: true,
          },
          routingKey: configService.get<string>(
            'RABBITMQ_NOTIFICATIONS_ROUTING_KEY',
            'telegram.pending',
          ),
          urls: [
            configService.get<string>('RABBITMQ_URL', 'amqp://127.0.0.1:5672'),
          ],
          wildcards: true,
        },
      }),
    },
  );

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  await app.listen();
}

void bootstrap();
