import {
  boolean,
  decimal,
  int,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from './_shared';

export const exchangeRateConfigs = mysqlTable(
  'exchange_rate_configs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    fromAssetId: varchar('from_asset_id', { length: 36 }).notNull(),
    toAssetId: varchar('to_asset_id', { length: 36 }).notNull(),
    rate: decimal('rate', { precision: 30, scale: 12 }).notNull(),
    feeBps: int('fee_bps').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    uniqueIndex('exchange_rate_pair_unique').on(
      table.fromAssetId,
      table.toAssetId,
    ),
  ],
);
