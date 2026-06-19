type RawEnv = Record<string, unknown>;

import { getDefaultCorsOrigins } from '../http/cors';

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArrayCsv(value: unknown, fallback: string[]) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback.join(',');
  }

  return value;
}

function isProductionLike(nodeEnv: string) {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

export function validateEnv(config: RawEnv) {
  const nodeEnv = asString(config.NODE_ENV, 'development');
  const validated = {
    HOST: asString(config.HOST, '0.0.0.0'),
    NODE_ENV: nodeEnv,
    PORT: asNumber(config.PORT, 3000),
    DATABASE_HOST: asString(config.DATABASE_HOST, '127.0.0.1'),
    DATABASE_PORT: asNumber(config.DATABASE_PORT, 3307),
    DATABASE_USER: asString(config.DATABASE_USER, 'nganluong'),
    DATABASE_PASSWORD: asString(config.DATABASE_PASSWORD, 'nganluong'),
    DATABASE_NAME: asString(config.DATABASE_NAME, 'nganluong_api'),
    DATABASE_CONNECTION_LIMIT: asNumber(config.DATABASE_CONNECTION_LIMIT, 10),
    BANNER_UPLOAD_DIR: asString(
      config.BANNER_UPLOAD_DIR,
      'storage/homepage-banners',
    ),
    RABBITMQ_URL: asString(config.RABBITMQ_URL, 'amqp://127.0.0.1:5672'),
    RABBITMQ_NOTIFICATIONS_EXCHANGE: asString(
      config.RABBITMQ_NOTIFICATIONS_EXCHANGE,
      'admin_notifications',
    ),
    RABBITMQ_NOTIFICATIONS_ROUTING_KEY: asString(
      config.RABBITMQ_NOTIFICATIONS_ROUTING_KEY,
      'telegram.pending',
    ),
    NOTIFICATION_OUTBOX_BATCH_SIZE: asNumber(
      config.NOTIFICATION_OUTBOX_BATCH_SIZE,
      20,
    ),
    NOTIFICATION_OUTBOX_POLL_INTERVAL_MS: asNumber(
      config.NOTIFICATION_OUTBOX_POLL_INTERVAL_MS,
      5000,
    ),
    NOTIFICATION_OUTBOX_MAX_ATTEMPTS: asNumber(
      config.NOTIFICATION_OUTBOX_MAX_ATTEMPTS,
      5,
    ),
    COINGECKO_API_BASE_URL: asString(
      config.COINGECKO_API_BASE_URL,
      'https://api.coingecko.com/api/v3',
    ),
    COINBASE_API_BASE_URL: asString(
      config.COINBASE_API_BASE_URL,
      'https://api.coinbase.com',
    ),
    COINGECKO_API_TIMEOUT_MS: asNumber(config.COINGECKO_API_TIMEOUT_MS, 5000),
    JWT_ACCESS_SECRET: asString(
      config.JWT_ACCESS_SECRET,
      'local-access-secret-change-me',
    ),
    JWT_ACCESS_TTL: asString(config.JWT_ACCESS_TTL, '15m'),
    TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY: asString(
      config.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY,
      '',
    ),
    TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: asString(
      config.TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN,
      '',
    ),
    RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY: asString(
      config.RABBITMQ_TELEGRAM_CONFIG_ROUTING_KEY,
      'telegram.config.updated',
    ),
    REFRESH_TOKEN_TTL_DAYS: asNumber(config.REFRESH_TOKEN_TTL_DAYS, 30),
    SUPER_ADMIN_EMAIL: asString(
      config.SUPER_ADMIN_EMAIL,
      'superadmin@example.com',
    ),
    SUPER_ADMIN_PASSWORD: asString(config.SUPER_ADMIN_PASSWORD, 'ChangeMe123!'),
    SUPER_ADMIN_PHONE: asString(config.SUPER_ADMIN_PHONE, ''),
    CORS_ALLOWED_ORIGINS: asStringArrayCsv(
      config.CORS_ALLOWED_ORIGINS,
      getDefaultCorsOrigins(),
    ),
  };

  if (
    isProductionLike(nodeEnv) &&
    (validated.JWT_ACCESS_SECRET === 'local-access-secret-change-me' ||
      validated.SUPER_ADMIN_EMAIL === 'superadmin@example.com' ||
      validated.SUPER_ADMIN_PASSWORD === 'ChangeMe123!')
  ) {
    throw new Error('Production configuration must override sample auth secrets');
  }

  if (!validated.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY.trim()) {
    throw new Error('Missing TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY configuration');
  }

  if (
    !validated.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY.trim() ||
    validated.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY.trim().length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(
      validated.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY.trim(),
    ) ||
    Buffer.from(
      validated.TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY.trim(),
      'base64',
    ).length !== 32
  ) {
    throw new Error(
      'TELEGRAM_RUNTIME_CONFIG_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
    );
  }

  if (!validated.TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN.trim()) {
    throw new Error('Missing TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN configuration');
  }

  return validated;
}
