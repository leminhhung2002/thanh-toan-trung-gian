import {
  bigint,
  boolean,
  int,
  mysqlTable,
  sql,
  timestamp,
  uniqueIndex,
  varchar,
} from './_shared';

export const bankAccounts = mysqlTable(
  'bank_accounts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    bankCode: varchar('bank_code', { length: 32 }).notNull(),
    bankName: varchar('bank_name', { length: 100 }).notNull(),
    accountNumber: varchar('account_number', { length: 100 }).notNull(),
    accountName: varchar('account_name', { length: 100 }).notNull(),
    dailyLimitMinor: bigint('daily_limit_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    usedTodayMinor: bigint('used_today_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    priority: int('priority').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('bank_accounts_priority_unique').on(table.priority),
    uniqueIndex('bank_accounts_identity_unique').on(
      table.bankCode,
      table.accountNumber,
    ),
  ],
);
