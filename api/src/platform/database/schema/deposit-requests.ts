import {
  bigint,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from './_shared';

export const depositRequests = mysqlTable(
  'deposit_requests',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    assetId: varchar('asset_id', { length: 36 }).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    method: varchar('method', { length: 50 }).notNull(),
    bankAccountId: varchar('bank_account_id', { length: 36 }),
    destinationRef: varchar('destination_ref', { length: 255 }),
    externalReference: varchar('external_reference', { length: 255 }),
    proofUrl: varchar('proof_url', { length: 500 }),
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
  (table) => [index('deposit_user_idx').on(table.userId)],
);
