import {
  bigint,
  mysqlTable,
  sql,
  timestamp,
  uniqueIndex,
  varchar,
} from './_shared';

export const wallets = mysqlTable(
  'wallets',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    assetId: varchar('asset_id', { length: 36 }).notNull(),
    availableMinor: bigint('available_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    pendingMinor: bigint('pending_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    totalMinor: bigint('total_minor', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('wallets_user_asset_unique').on(table.userId, table.assetId),
  ],
);
