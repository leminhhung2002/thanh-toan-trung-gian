import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CoinGeckoSimplePriceResponse = {
  tether?: {
    vnd?: number;
  };
};

@Injectable()
export class CoinGeckoPricingService {
  constructor(private readonly configService: ConfigService) {}

  async getUsdtPriceInVnd() {
    const baseUrl = this.configService.get<string>(
      'COINGECKO_API_BASE_URL',
      'https://api.coingecko.com/api/v3',
    );
    const timeoutMs = this.configService.get<number>(
      'COINGECKO_API_TIMEOUT_MS',
      5000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl}/simple/price?ids=tether&vs_currencies=vnd`,
        {
          headers: {
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: 'exchange_rate_unavailable',
          message: 'Không thể lấy tỷ giá realtime để đổi tiền.',
        });
      }

      const data =
        (await response.json()) as CoinGeckoSimplePriceResponse | null;
      const vndPrice = data?.tether?.vnd;

      if (
        typeof vndPrice !== 'number' ||
        !Number.isFinite(vndPrice) ||
        vndPrice <= 0
      ) {
        throw new ServiceUnavailableException({
          code: 'exchange_rate_unavailable',
          message: 'Không thể lấy tỷ giá realtime để đổi tiền.',
        });
      }

      return String(vndPrice);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException({
        code: 'exchange_rate_unavailable',
        message: 'Không thể lấy tỷ giá realtime để đổi tiền.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
