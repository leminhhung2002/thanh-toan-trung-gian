import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import { schema } from '../platform/database/schema';

function getDatabaseConfig() {
  return {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3307),
    user: process.env.DATABASE_USER ?? 'nganluong',
    password: process.env.DATABASE_PASSWORD ?? 'nganluong',
    database: process.env.DATABASE_NAME ?? 'nganluong_api',
  };
}

function isProductionLikeEnvironment(nodeEnv: string | undefined) {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

function isSafeResetDatabaseName(databaseName: string) {
  return databaseName.endsWith('_local') || databaseName.endsWith('_test');
}

function assertResetDatabaseAllowed(databaseName: string) {
  if (isProductionLikeEnvironment(process.env.NODE_ENV)) {
    throw new Error(
      'db:reset is disabled in production and staging environments.',
    );
  }

  if (process.env.ALLOW_DB_RESET !== 'true') {
    throw new Error('db:reset requires ALLOW_DB_RESET=true.');
  }

  if (!isSafeResetDatabaseName(databaseName)) {
    throw new Error(
      'db:reset is only allowed for databases ending in _local or _test.',
    );
  }
}

export async function resetDatabase() {
  const { database, ...connectionConfig } = getDatabaseConfig();
  assertResetDatabaseAllowed(database);
  const adminConnection = await mysql.createConnection(connectionConfig);
  const escapedDatabaseName = database.replaceAll('`', '``');

  try {
    await adminConnection.query(
      `DROP DATABASE IF EXISTS \`${escapedDatabaseName}\``,
    );
    await adminConnection.query(`CREATE DATABASE \`${escapedDatabaseName}\``);
  } finally {
    await adminConnection.end();
  }
}

export async function runMigrations() {
  const connection = await mysql.createConnection(getDatabaseConfig());

  try {
    const db = drizzle(connection, { schema, mode: 'default' });
    await migrate(db, {
      migrationsFolder: resolve(process.cwd(), 'drizzle'),
    });
  } finally {
    await connection.end();
  }
}

async function main() {
  if (process.argv.includes('--reset')) {
    await resetDatabase();
  }

  await runMigrations();
}

if (
  process.argv[1]?.endsWith('/migrate.ts') ||
  process.argv[1]?.endsWith('/migrate.js')
) {
  void main();
}
