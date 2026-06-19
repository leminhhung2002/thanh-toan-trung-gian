type RawEnv = Record<string, unknown>;

function asString(value: unknown, fallback?: string) {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error('Missing required string env value');
}

function asNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateEnv(config: RawEnv) {
  return {
    API_INTERNAL_BASE_URL: asString(config.API_INTERNAL_BASE_URL),
    RABBITMQ_NOTIFICATIONS_DEAD_QUEUE: asString(
      config.RABBITMQ_NOTIFICATIONS_DEAD_QUEUE,
      'telegram_notifications_dead',
    ),
    RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE: asString(
      config.RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE,
      'telegram_config_updates',
    ),
    RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY: asString(
      config.RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY,
      'telegram.config.updated',
    ),
    RABBITMQ_NOTIFICATIONS_EXCHANGE: asString(
      config.RABBITMQ_NOTIFICATIONS_EXCHANGE,
      'admin_notifications',
    ),
    RABBITMQ_NOTIFICATIONS_QUEUE: asString(
      config.RABBITMQ_NOTIFICATIONS_QUEUE,
      'telegram_notifications',
    ),
    RABBITMQ_NOTIFICATIONS_ROUTING_KEY: asString(
      config.RABBITMQ_NOTIFICATIONS_ROUTING_KEY,
      'telegram.pending',
    ),
    RABBITMQ_NOTIFICATIONS_RETRY_QUEUE: asString(
      config.RABBITMQ_NOTIFICATIONS_RETRY_QUEUE,
      'telegram_notifications_retry',
    ),
    RABBITMQ_URL: asString(config.RABBITMQ_URL, 'amqp://127.0.0.1:5672'),
    TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: asString(
      config.TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN,
    ),
    TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS: asNumber(
      config.TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS,
      30000,
    ),
    TELEGRAM_SEND_MAX_ATTEMPTS: asNumber(config.TELEGRAM_SEND_MAX_ATTEMPTS, 5),
  };
}
