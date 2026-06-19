import {
  bigint,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from './_shared';

export const ledgerEntries = mysqlTable(
  'ledger_entries',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    walletId: varchar('wallet_id', { length: 36 }).notNull(),
    bucket: mysqlEnum('bucket', ['available', 'pending', 'total']).notNull(),
    direction: mysqlEnum('direction', ['credit', 'debit']).notNull(),
    amountMinor: bigint('amount_minor', { mode: 'bigint' }).notNull(),
    balanceBeforeMinor: bigint('balance_before_minor', {
      mode: 'bigint',
    }).notNull(),
    balanceAfterMinor: bigint('balance_after_minor', {
      mode: 'bigint',
    }).notNull(),
    referenceType: varchar('reference_type', { length: 64 }).notNull(),
    referenceId: varchar('reference_id', { length: 36 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }),
    note: text('note'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('ledger_wallet_idx').on(table.walletId),
    index('ledger_reference_idx').on(table.referenceType, table.referenceId),
  ],
);
