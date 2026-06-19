import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import { Injectable } from '@nestjs/common';
import { and, asc, eq, lte } from 'drizzle-orm';
import { DatabaseService } from '../../platform/database/database.service';
import { notificationOutbox } from '../../platform/database/schema';

export type NotificationOutboxRecord = typeof notificationOutbox.$inferSelect;

export interface NotificationOutboxRepository {
  listReadyBatch(limit: number, now: Date): Promise<NotificationOutboxRecord[]>;
  markPublished(id: string, publishedAt: Date): Promise<void>;
  markRetryResult(
    id: string,
    input: {
      attemptCount: number;
      lastError: string;
      nextAttemptAt: Date;
      status: 'pending' | 'dead';
    },
  ): Promise<void>;
}

@Injectable()
export class DrizzleNotificationOutboxRepository
  implements NotificationOutboxRepository
{
  constructor(private readonly databaseService: DatabaseService) {}

  listReadyBatch(limit: number, now: Date) {
    return this.databaseService.db
      .select()
      .from(notificationOutbox)
      .where(
        and(
          lte(notificationOutbox.nextAttemptAt, now),
          eq(notificationOutbox.status, 'pending'),
        ),
      )
      .orderBy(
        asc(notificationOutbox.nextAttemptAt),
        asc(notificationOutbox.createdAt),
      )
      .limit(limit);
  }

  async markPublished(id: string, publishedAt: Date) {
    await this.databaseService.db
      .update(notificationOutbox)
      .set({
        lastError: null,
        publishedAt,
        status: 'published',
      })
      .where(eq(notificationOutbox.id, id));
  }

  async markRetryResult(
    id: string,
    input: {
      attemptCount: number;
      lastError: string;
      nextAttemptAt: Date;
      status: 'pending' | 'dead';
    },
  ) {
    await this.databaseService.db
      .update(notificationOutbox)
      .set({
        attemptCount: input.attemptCount,
        lastError: input.lastError,
        nextAttemptAt: input.nextAttemptAt,
        status: input.status,
      })
      .where(eq(notificationOutbox.id, id));
  }
}

export function serializeNotificationEvent(
  value: AdminNotificationEvent,
): AdminNotificationEvent {
  return value;
}
