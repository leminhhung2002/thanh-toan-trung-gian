import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CoinbaseExchangeRatesResponse = {
  data?: {
    rates?: Record<string, string | number | undefined>;
  };
};

type CoinGeckoSimplePriceResponse = {
  tether?: {
    vnd?: number;
  };
};

@Injectable()
export class ExchangePricingService {
  private readonly logger = new Logger(ExchangePricingService.name);
  private readonly cacheTtlMs = 2 * 60 * 1000;
  private lastSuccessfulRate: string | null = null;
  private lastSuccessfulAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async getUsdtPriceInVnd() {
    const coinbaseRate = await this.tryCoinbaseRate();

    if (coinbaseRate) {
      return this.cacheSuccessfulRate(coinbaseRate);
    }

    const coinGeckoRate = await this.tryCoinGeckoRate();

    if (coinGeckoRate) {
      return this.cacheSuccessfulRate(coinGeckoRate);
    }

    const cachedRate = this.getCachedRate();

    if (cachedRate) {
      this.logger.warn('Using cached exchange rate after provider failures.');
      return cachedRate;
    }

    throw new ServiceUnavailableException({
      code: 'exchange_rate_unavailable',
      message: 'Không thể lấy tỷ giá realtime để đổi tiền.',
    });
  }

  private async tryCoinbaseRate() {
    const baseUrl = this.configService.get<string>(
      'COINBASE_API_BASE_URL',
      'https://api.coinbase.com',
    );

    try {
      const response = await this.fetchJson<CoinbaseExchangeRatesResponse>(
        `${baseUrl}/v2/exchange-rates?currency=USDT`,
      );
      const rawRate = response.data?.rates?.VND;
      return this.normalizeRateValue(rawRate);
    } catch (error) {
      this.logger.warn(
        `Coinbase realtime pricing unavailable: ${this.describeError(error)}`,
      );
      return null;
    }
  }

  private async tryCoinGeckoRate() {
    const baseUrl = this.configService.get<string>(
      'COINGECKO_API_BASE_URL',
      'https://api.coingecko.com/api/v3',
    );

    try {
      const response = await this.fetchJson<CoinGeckoSimplePriceResponse>(
        `${baseUrl}/simple/price?ids=tether&vs_currencies=vnd`,
      );
      return this.normalizeRateValue(response.tether?.vnd);
    } catch (error) {
      this.logger.warn(
        `CoinGecko fallback pricing unavailable: ${this.describeError(error)}`,
      );
      return null;
    }
  }

  private async fetchJson<T>(url: string) {
    const timeoutMs = this.configService.get<number>(
      'COINGECKO_API_TIMEOUT_MS',
      5000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeRateValue(rawRate: number | string | undefined) {
    const rate = Number(rawRate);

    if (!Number.isFinite(rate) || rate <= 0) {
      return null;
    }

    return String(Math.round(rate));
  }

  private cacheSuccessfulRate(rate: string) {
    this.lastSuccessfulRate = rate;
    this.lastSuccessfulAt = Date.now();
    return rate;
  }

  private getCachedRate() {
    if (!this.lastSuccessfulRate) {
      return null;
    }

    if (Date.now() - this.lastSuccessfulAt > this.cacheTtlMs) {
      this.lastSuccessfulRate = null;
      this.lastSuccessfulAt = 0;
      return null;
    }

    return this.lastSuccessfulRate;
  }

  private describeError(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'unknown error';
  }
}
