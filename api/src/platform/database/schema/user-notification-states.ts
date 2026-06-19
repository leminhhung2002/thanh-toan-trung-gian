import { mysqlTable, timestamp, varchar } from './_shared';

export const userNotificationStates = mysqlTable('user_notification_states', {
  userId: varchar('user_id', { length: 36 }).primaryKey(),
  lastReadAt: timestamp('last_read_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});
