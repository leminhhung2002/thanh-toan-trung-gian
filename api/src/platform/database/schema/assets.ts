import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  timestamp,
  uniqueIndex,
  varchar,
} from './_shared';

export const assets = mysqlTable(
  'assets',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    code: varchar('code', { length: 16 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    kind: mysqlEnum('kind', ['fiat', 'crypto']).notNull(),
    assetPrecision: int('asset_precision').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [uniqueIndex('assets_code_unique').on(table.code)],
);
