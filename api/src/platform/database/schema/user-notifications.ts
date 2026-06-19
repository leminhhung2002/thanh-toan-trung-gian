import {
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from './_shared';

export const userNotifications = mysqlTable(
  'user_notifications',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    userId: varchar('user_id', { length: 36 }).notNull(),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 120 }).notNull(),
    secondaryText: text('secondary_text').notNull(),
    primaryAmount: varchar('primary_amount', { length: 64 }).notNull(),
    primaryAmountTone: mysqlEnum('primary_amount_tone', [
      'plus',
      'minus',
      'neutral',
    ]).notNull(),
    primaryAssetCode: varchar('primary_asset_code', { length: 16 }).notNull(),
    referenceType: varchar('reference_type', { length: 64 }).notNull(),
    referenceId: varchar('reference_id', { length: 36 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('user_notifications_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('user_notifications_reference_idx').on(
      table.referenceType,
      table.referenceId,
    ),
  ],
);
