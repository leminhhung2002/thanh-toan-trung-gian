import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type {
  NotificationOutboxRecord,
  NotificationOutboxRepository,
} from './notification-outbox.repository';
import { NotificationsRabbitPublisher } from './notifications-rabbit.publisher';

export const NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS = Symbol(
  'NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS',
);

export type NotificationOutboxPublisherOptions = {
  batchSize: number;
  maxAttempts: number;
  retryBaseDelayMs: number;
};

@Injectable()
export class NotificationOutboxPublisherService {
  private readonly logger = new Logger(NotificationOutboxPublisherService.name);
  private readonly options: NotificationOutboxPublisherOptions;

  constructor(
    @Inject('NotificationOutboxRepository')
    private readonly outboxRepository: NotificationOutboxRepository,
    private readonly publisher: NotificationsRabbitPublisher,
    @Optional()
    @Inject(NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS)
    options?: NotificationOutboxPublisherOptions,
  ) {
    this.options = options ?? {
      batchSize: 20,
      maxAttempts: 5,
      retryBaseDelayMs: 1000,
    };
  }

  async publishPendingBatch(now = new Date()) {
    const rows = await this.outboxRepository.listReadyBatch(
      this.options.batchSize,
      now,
    );

    for (const row of rows) {
      await this.publishRow(row, now);
    }
  }

  private async publishRow(row: NotificationOutboxRecord, now: Date) {
    try {
      await this.publisher.publish(row.payload);
      await this.outboxRepository.markPublished(row.id, new Date());
    } catch (error) {
      const nextAttemptCount = row.attemptCount + 1;
      const status =
        nextAttemptCount >= this.options.maxAttempts ? 'dead' : 'pending';
      const delayFactor = 2 ** Math.min(nextAttemptCount, this.options.maxAttempts - 1);
      const nextAttemptAt = new Date(
        now.getTime() + this.options.retryBaseDelayMs * delayFactor,
      );
      const lastError =
        error instanceof Error ? error.message : 'Unknown RabbitMQ publish error';

      await this.outboxRepository.markRetryResult(row.id, {
        attemptCount: nextAttemptCount,
        lastError,
        nextAttemptAt,
        status,
      });

      this.logger.warn(
        `Failed to publish notification ${row.id}: ${lastError} (status ${status})`,
      );
    }
  }
}
