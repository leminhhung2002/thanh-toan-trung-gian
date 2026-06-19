import {
  bigint,
  index,
  mysqlEnum,
  mysqlTable,
  timestamp,
  varchar,
} from './_shared';

export const depositReservations = mysqlTable(
  'deposit_reservations',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    assetId: varchar('asset_id', { length: 36 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    method: varchar('method', { length: 50 }).notNull(),
    bankAccountId: varchar('bank_account_id', { length: 36 }).notNull(),
    transferContent: varchar('transfer_content', { length: 255 }).notNull(),
    status: mysqlEnum('status', [
      'active',
      'pending_review',
      'approved',
      'rejected',
      'expired',
      'cancelled',
    ])
      .notNull()
      .default('active'),
    expiresAt: timestamp('expires_at').notNull(),
    confirmedAt: timestamp('confirmed_at'),
    depositRequestId: varchar('deposit_request_id', { length: 36 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    index('deposit_reservations_user_idx').on(table.userId),
    index('deposit_reservations_bank_status_idx').on(
      table.bankAccountId,
      table.status,
    ),
    index('deposit_reservations_expires_idx').on(table.expiresAt),
  ],
);
