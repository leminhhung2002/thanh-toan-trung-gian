import { resetDatabase, runMigrations } from '../src/scripts/migrate';

export async function ensureTestDatabase() {
  process.env.TWO_FACTOR_ENCRYPTION_KEY ??=
    'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=';
process.env.TWO_FACTOR_ISSUER ??= 'Tài khoản trung gian';
  await resetDatabase();
  await runMigrations();
}
