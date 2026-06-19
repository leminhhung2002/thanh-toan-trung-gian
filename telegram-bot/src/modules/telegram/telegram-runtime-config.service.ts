import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type TelegramRuntimeConfigSnapshot = {
  chatId: string;
  token: string;
  version: number;
};

export type TelegramRuntimeConfigStatus = {
  hasUsableConfig: boolean;
  lastErrorMessage: string | null;
  lastRefreshAttemptAt: Date | null;
  lastRefreshSucceededAt: Date | null;
  version: number | null;
};

type ApiEnvelope<T> = {
  data: T;
};

export class TelegramRuntimeConfigUnavailableError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TelegramRuntimeConfigUnavailableError';
    this.cause = cause;
  }
}

@Injectable()
export class TelegramRuntimeConfigService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TelegramRuntimeConfigService.name);
  private currentConfig: TelegramRuntimeConfigSnapshot | null = null;
  private lastRefreshAttemptAt: Date | null = null;
  private lastRefreshError: TelegramRuntimeConfigUnavailableError | null = null;
  private lastRefreshSucceededAt: Date | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      await this.loadAndSwap();
    } catch (error) {
      const runtimeConfigError = this.normalizeRuntimeConfigError(error);
      this.logger.error(
        `Telegram runtime config unavailable during bootstrap: ${runtimeConfigError.message}`,
      );
    }

    const pollIntervalMs = this.configService.get<number>(
      'TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS',
      30000,
    );

    this.pollTimer = setInterval(() => {
      void this.refreshActiveConfig('poll').catch((error) => {
        this.logger.warn(
          `Failed to refresh Telegram runtime config via polling: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      });
    }, pollIntervalMs);
    this.pollTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getActiveConfigOrThrow() {
    if (!this.currentConfig) {
      throw (
        this.lastRefreshError ??
        new TelegramRuntimeConfigUnavailableError(
          'Telegram runtime config is unavailable.',
        )
      );
    }

    return this.currentConfig;
  }

  getStatus(): TelegramRuntimeConfigStatus {
    return {
      hasUsableConfig: this.currentConfig !== null,
      lastErrorMessage: this.lastRefreshError?.message ?? null,
      lastRefreshAttemptAt: this.lastRefreshAttemptAt,
      lastRefreshSucceededAt: this.lastRefreshSucceededAt,
      version: this.currentConfig?.version ?? null,
    };
  }

  async refreshActiveConfig(_reason: string) {
    const previous = this.currentConfig;

    try {
      await this.loadAndSwap();
    } catch (error) {
      if (previous) {
        this.currentConfig = previous;
      }

      throw this.normalizeRuntimeConfigError(error);
    }
  }

  private async loadAndSwap() {
    this.lastRefreshAttemptAt = new Date();

    try {
      const nextConfig = await this.fetchRuntimeConfig();
      this.currentConfig = nextConfig;
      this.lastRefreshError = null;
      this.lastRefreshSucceededAt = new Date();
    } catch (error) {
      this.lastRefreshError = this.normalizeRuntimeConfigError(error);
      throw this.lastRefreshError;
    }
  }

  private async fetchRuntimeConfig() {
    const baseUrl = this.configService
      .getOrThrow<string>('API_INTERNAL_BASE_URL')
      .replace(/\/+$/, '');
    const response = await globalThis.fetch(
      `${baseUrl}/api/v1/internal/integrations/telegram/runtime-config`,
      {
        headers: {
          'x-internal-token': this.configService.getOrThrow<string>(
            'TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN',
          ),
        },
        method: 'GET',
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load Telegram runtime config: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as ApiEnvelope<TelegramRuntimeConfigSnapshot>;
    return payload.data;
  }

  private normalizeRuntimeConfigError(error: unknown) {
    if (error instanceof TelegramRuntimeConfigUnavailableError) {
      return error;
    }

    if (error instanceof Error) {
      return new TelegramRuntimeConfigUnavailableError(error.message, error);
    }

    return new TelegramRuntimeConfigUnavailableError(
      'Telegram runtime config is unavailable.',
      error,
    );
  }
}
