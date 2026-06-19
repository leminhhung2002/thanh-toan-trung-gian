import { mysqlTable, primaryKey, timestamp, varchar } from './_shared';

export const userRoles = mysqlTable(
  'user_roles',
  {
    userId: varchar('user_id', { length: 36 }).notNull(),
    roleId: varchar('role_id', { length: 36 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);
