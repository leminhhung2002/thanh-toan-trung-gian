import {
  bigint,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from './_shared';

export const exchangeOrders = mysqlTable(
  'exchange_orders',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    quoteId: varchar('quote_id', { length: 36 }).notNull(),
    fromAssetId: varchar('from_asset_id', { length: 36 }).notNull(),
    toAssetId: varchar('to_asset_id', { length: 36 }).notNull(),
    fromAmountMinor: bigint('from_amount_minor', { mode: 'bigint' }).notNull(),
    feeAmountMinor: bigint('fee_amount_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    totalDebitMinor: bigint('total_debit_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    toAmountMinor: bigint('to_amount_minor', { mode: 'bigint' }).notNull(),
    rate: decimal('rate', { precision: 30, scale: 12 }).notNull(),
    realtimeRateVnd: decimal('realtime_rate_vnd', {
      precision: 30,
      scale: 12,
    })
      .notNull()
      .default('0'),
    appliedMarkupVnd: int('applied_markup_vnd').notNull().default(0),
    feeBps: int('fee_bps').notNull().default(0),
    feeProfitVndMinor: bigint('fee_profit_vnd_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    markupProfitVndMinor: bigint('markup_profit_vnd_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    status: mysqlEnum('status', ['completed', 'reversed'])
      .notNull()
      .default('completed'),
    reversedAt: timestamp('reversed_at'),
    reversedBy: varchar('reversed_by', { length: 36 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('exchange_orders_user_idx').on(table.userId)],
);
