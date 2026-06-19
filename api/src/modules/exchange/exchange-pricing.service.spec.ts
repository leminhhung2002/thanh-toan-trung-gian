import { ServiceUnavailableException } from '@nestjs/common';
import { ExchangePricingService } from './exchange-pricing.service';

describe('ExchangePricingService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses Coinbase as the primary realtime source', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            rates: {
              VND: '26320.5',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    ) as typeof fetch;

    const service = new ExchangePricingService({
      get: jest
        .fn()
        .mockImplementation((key: string, fallback?: unknown) => {
          if (key === 'COINBASE_API_BASE_URL') return 'https://api.coinbase.com';
          if (key === 'COINGECKO_API_BASE_URL')
            return 'https://api.coingecko.com/api/v3';
          return fallback;
        }),
    } as never);

    await expect(service.getUsdtPriceInVnd()).resolves.toBe('26321');
  });

  it('falls back to CoinGecko when Coinbase is unavailable', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: ['upstream unavailable'],
          }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            tether: {
              vnd: 26327,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      ) as typeof fetch;

    const service = new ExchangePricingService({
      get: jest
        .fn()
        .mockImplementation((key: string, fallback?: unknown) => {
          if (key === 'COINBASE_API_BASE_URL') return 'https://api.coinbase.com';
          if (key === 'COINGECKO_API_BASE_URL')
            return 'https://api.coingecko.com/api/v3';
          return fallback;
        }),
    } as never);

    await expect(service.getUsdtPriceInVnd()).resolves.toBe('26327');
  });

  it('reuses the last successful rate when both providers fail briefly', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              rates: {
                VND: '26320.5',
              },
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockRejectedValueOnce(new Error('coinbase down'))
      .mockRejectedValueOnce(new Error('coingecko down')) as typeof fetch;

    const service = new ExchangePricingService({
      get: jest
        .fn()
        .mockImplementation((key: string, fallback?: unknown) => {
          if (key === 'COINBASE_API_BASE_URL') return 'https://api.coinbase.com';
          if (key === 'COINGECKO_API_BASE_URL')
            return 'https://api.coingecko.com/api/v3';
          if (key === 'COINGECKO_API_TIMEOUT_MS') return 5000;
          return fallback;
        }),
    } as never);

    await expect(service.getUsdtPriceInVnd()).resolves.toBe('26321');
    await expect(service.getUsdtPriceInVnd()).resolves.toBe('26321');
  });

  it('throws exchange_rate_unavailable when no provider or cache is usable', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('coinbase down'))
      .mockRejectedValueOnce(new Error('coingecko down')) as typeof fetch;

    const service = new ExchangePricingService({
      get: jest
        .fn()
        .mockImplementation((key: string, fallback?: unknown) => {
          if (key === 'COINBASE_API_BASE_URL') return 'https://api.coinbase.com';
          if (key === 'COINGECKO_API_BASE_URL')
            return 'https://api.coingecko.com/api/v3';
          if (key === 'COINGECKO_API_TIMEOUT_MS') return 5000;
          return fallback;
        }),
    } as never);

    await expect(service.getUsdtPriceInVnd()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
