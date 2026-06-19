import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts the internal API runtime config settings and queue defaults', () => {
    expect(
      validateEnv({
        API_INTERNAL_BASE_URL: 'http://127.0.0.1:3000',
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toMatchObject({
      API_INTERNAL_BASE_URL: 'http://127.0.0.1:3000',
      RABBITMQ_NOTIFICATIONS_CONFIG_QUEUE: 'telegram_config_updates',
      RABBITMQ_NOTIFICATIONS_CONFIG_ROUTING_KEY: 'telegram.config.updated',
      TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS: 30000,
    });
  });

  it('rejects missing internal API base urls', () => {
    expect(() =>
      validateEnv({
        TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN: 'internal-token',
      }),
    ).toThrow('Missing required string env value');
  });

  it('rejects missing internal auth tokens', () => {
    expect(() =>
      validateEnv({
        API_INTERNAL_BASE_URL: 'http://127.0.0.1:3000',
      }),
    ).toThrow('Missing required string env value');
  });
});
