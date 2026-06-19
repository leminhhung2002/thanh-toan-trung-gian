import type { Config } from 'drizzle-kit';

export default {
  dialect: 'mysql',
  schema: './src/platform/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3307),
    user: process.env.DATABASE_USER ?? 'nganluong',
    password: process.env.DATABASE_PASSWORD ?? 'nganluong',
    database: process.env.DATABASE_NAME ?? 'nganluong_api',
  },
} satisfies Config;
