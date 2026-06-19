import { mysqlTable, text, timestamp, varchar } from './_shared';

export const settings = mysqlTable('settings', {
  key: varchar('key_name', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});
