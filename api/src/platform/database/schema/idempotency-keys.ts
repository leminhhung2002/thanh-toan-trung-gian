import { mysqlTable, timestamp, uniqueIndex, varchar } from './_shared';

export const idempotencyKeys = mysqlTable(
  'idempotency_keys',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    actorId: varchar('actor_id', { length: 36 }).notNull(),
    scope: varchar('scope', { length: 100 }).notNull(),
    keyName: varchar('key_name', { length: 128 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idempotency_actor_scope_key_unique').on(
      table.actorId,
      table.scope,
      table.keyName,
    ),
  ],
);
