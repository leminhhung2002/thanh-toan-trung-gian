import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS,
  type NotificationOutboxPublisherOptions,
  NotificationOutboxPublisherService,
} from './notification-outbox-publisher.service';

const NOTIFICATION_OUTBOX_INTERVAL = 'notification-outbox-publisher';

@Injectable()
export class NotificationOutboxPublisherRunner
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationOutboxPublisherRunner.name);
  private isRunning = false;

  constructor(
    private readonly publisherService: NotificationOutboxPublisherService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(NOTIFICATION_OUTBOX_PUBLISHER_OPTIONS)
    private readonly options: NotificationOutboxPublisherOptions,
  ) {}

  onModuleInit() {
    const interval = setInterval(() => {
      void this.tick();
    }, this.options.retryBaseDelayMs);

    this.schedulerRegistry.addInterval(NOTIFICATION_OUTBOX_INTERVAL, interval);
  }

  onModuleDestroy() {
    if (this.schedulerRegistry.doesExist('interval', NOTIFICATION_OUTBOX_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(NOTIFICATION_OUTBOX_INTERVAL);
    }
  }

  private async tick() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      await this.publisherService.publishPendingBatch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown notification publisher failure';
      this.logger.warn(`Notification outbox tick failed: ${message}`);
    } finally {
      this.isRunning = false;
    }
  }
}
