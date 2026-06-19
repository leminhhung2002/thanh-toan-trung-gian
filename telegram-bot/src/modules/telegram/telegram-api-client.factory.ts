import { Inject, Injectable, Optional } from '@nestjs/common';
import { Api, type RawApi } from 'grammy';
import type { TelegramRuntimeConfigSnapshot } from './telegram-runtime-config.service';

export type TelegramApiClient = Pick<Api<RawApi>, 'sendMessage'>;
export type TelegramApiClientBuilder = (token: string) => TelegramApiClient;

export const TELEGRAM_API_CLIENT_BUILDER = Symbol(
  'TELEGRAM_API_CLIENT_BUILDER',
);

type CachedTelegramApiClient = {
  client: TelegramApiClient;
  token: string;
  version: number;
};

@Injectable()
export class TelegramApiClientFactory {
  private cachedClient: CachedTelegramApiClient | null = null;
  private readonly buildClient: TelegramApiClientBuilder;

  constructor(
    @Optional()
    @Inject(TELEGRAM_API_CLIENT_BUILDER)
    buildClient?: TelegramApiClientBuilder,
  ) {
    this.buildClient = buildClient ?? ((token) => new Api(token));
  }

  getClient(config: TelegramRuntimeConfigSnapshot) {
    if (
      this.cachedClient &&
      this.cachedClient.token === config.token &&
      this.cachedClient.version === config.version
    ) {
      return this.cachedClient.client;
    }

    const client = this.buildClient(config.token);
    this.cachedClient = {
      client,
      token: config.token,
      version: config.version,
    };
    return client;
  }
}
