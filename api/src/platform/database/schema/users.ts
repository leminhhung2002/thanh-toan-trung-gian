import {
  boolean,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from './_shared';

export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 64 }),
    telegram: varchar('telegram', { length: 64 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
);
