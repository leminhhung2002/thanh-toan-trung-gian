import {
  TELEGRAM_RUNTIME_CONFIG_VERSION,
  type TelegramConfigUpdatedEvent,
} from '@nganluong/notification-contracts';

export function buildTelegramConfigUpdatedEvent(input: {
  updatedAt: Date;
  version: number;
}): TelegramConfigUpdatedEvent {
  return {
    eventType: 'telegram.config.updated',
    occurredAt: input.updatedAt.toISOString(),
    payload: {
      updatedAt: input.updatedAt.toISOString(),
      version: input.version,
    },
    version: TELEGRAM_RUNTIME_CONFIG_VERSION,
  };
}
