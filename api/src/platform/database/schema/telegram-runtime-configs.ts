import { int, mysqlTable, text, timestamp, varchar } from './_shared';

export const telegramRuntimeConfigs = mysqlTable('telegram_runtime_configs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  botUsername: varchar('bot_username', { length: 255 }),
  chatId: varchar('chat_id', { length: 255 }).notNull(),
  tokenEncrypted: text('token_encrypted').notNull(),
  tokenSuffix: varchar('token_suffix', { length: 4 }).notNull(),
  version: int('version').notNull().default(1),
  lastValidatedAt: timestamp('last_validated_at').notNull(),
  updatedBy: varchar('updated_by', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});
