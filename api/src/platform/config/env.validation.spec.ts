import { validateEnv } from './env.validation';

const VALID_TWO_FACTOR_KEY = Buffer.from(
  '0123456789abcdef0123456789abcdef',
  'utf8',
).toString('base64');

describe('validateEnv', () => {
  it('keeps development defaults for local work', () => {
    expect(
      validateEnv({
        NODE_ENV: 'development',
        TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toMatchObject({
      BANNER_UPLOAD_DIR: 'storage/homepage-banners',
      CORS_ALLOWED_ORIGINS:
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173',
      JWT_ACCESS_SECRET: 'local-access-secret-change-me',
      SUPER_ADMIN_EMAIL: 'superadmin@example.com',
      SUPER_ADMIN_PASSWORD: 'ChangeMe123!',
      TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
      TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
    });
  });

  it('rejects production-like environments that still use sample auth secrets', () => {
    expect(() =>
      validateEnv({
        JWT_ACCESS_SECRET: 'local-access-secret-change-me',
        NODE_ENV: 'production',
        SUPER_ADMIN_EMAIL: 'superadmin@example.com',
        SUPER_ADMIN_PASSWORD: 'ChangeMe123!',
        TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toThrow('Production configuration must override sample auth secrets');
  });

  it('allows legacy two-factor encryption keys to be omitted', () => {
    expect(
      validateEnv({
        NODE_ENV: 'development',
        TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toMatchObject({
      TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
      TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
    });
  });

  it('rejects missing Telegram runtime config encryption keys', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toThrow(
      'Missing TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY configuration',
    );
  });

  it('rejects Telegram runtime config encryption keys that are not 32-byte base64 values', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY:
          'test-telegram-runtime-config-key',
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toThrow(
      'TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  });

  it('rejects missing Telegram runtime config internal tokens', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: VALID_TWO_FACTOR_KEY,
      }),
    ).toThrow('Missing TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN configuration');
  });
});
