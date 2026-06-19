import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import type { MySql2Transaction } from 'drizzle-orm/mysql2/session';
import type { schema } from './schema';

export type AppSchema = typeof schema;
export type AppDatabase = MySql2Database<AppSchema>;
export type AppTransaction = MySql2Transaction<
  AppSchema,
  ExtractTablesWithRelations<AppSchema>
>;
