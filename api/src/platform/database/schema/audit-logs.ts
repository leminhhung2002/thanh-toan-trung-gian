import { index, json, mysqlTable, timestamp, varchar } from './_shared';

export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    actorUserId: varchar('actor_user_id', { length: 36 }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: varchar('entity_id', { length: 36 }).notNull(),
    metadata: json('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('audit_action_idx').on(table.action)],
);
