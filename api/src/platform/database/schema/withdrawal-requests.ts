import {
  bigint,
  index,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from './_shared';

export const withdrawalRequests = mysqlTable(
  'withdrawal_requests',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    assetId: varchar('asset_id', { length: 36 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    feeAmountMinor: bigint('fee_amount_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    feeProfitVndMinor: bigint('fee_profit_vnd_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    profitFxRateVnd: bigint('profit_fx_rate_vnd', { mode: 'bigint' }),
    totalDebitMinor: bigint('total_debit_minor', { mode: 'bigint' })
      .notNull()
      .default(0n),
    method: varchar('method', { length: 50 }).notNull(),
    destinationDetails: json('destination_details').$type<
      Record<string, unknown>
    >(),
    note: text('note'),
    status: mysqlEnum('status', ['pending', 'approved', 'rejected', 'cancelled'])
      .notNull()
      .default('pending'),
    reviewNote: text('review_note'),
    approvedBy: varchar('approved_by', { length: 36 }),
    approvedAt: timestamp('approved_at'),
    cancelledAt: timestamp('cancelled_at'),
    rejectedBy: varchar('rejected_by', { length: 36 }),
    rejectedAt: timestamp('rejected_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [index('withdrawal_user_idx').on(table.userId)],
);
