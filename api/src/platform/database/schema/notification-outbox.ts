import type { AdminNotificationEvent } from '@nganluong/notification-contracts';
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from './_shared';

export const notificationOutbox = mysqlTable(
  'notification_outbox',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 36 }).notNull(),
    payload: json('payload').$type<AdminNotificationEvent>().notNull(),
    status: mysqlEnum('status', ['pending', 'published', 'dead'])
      .notNull()
      .default('pending'),
    attemptCount: int('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at').notNull().defaultNow(),
    lastError: text('last_error'),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('notification_outbox_status_next_attempt_idx').on(
      table.status,
      table.nextAttemptAt,
    ),
    index('notification_outbox_entity_idx').on(table.entityType, table.entityId),
  ],
);
