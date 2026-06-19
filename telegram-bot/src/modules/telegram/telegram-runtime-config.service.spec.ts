import type { ConfigService } from '@nestjs/config';
import {
  TelegramRuntimeConfigService,
  TelegramRuntimeConfigUnavailableError,
} from './telegram-runtime-config.service';

describe('TelegramRuntimeConfigService', () => {
  const configService = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  let setIntervalSpy: jest.SpiedFunction<typeof global.setInterval>;
  const pollTimer = {
    unref: jest.fn(),
  } as unknown as NodeJS.Timeout;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock as typeof fetch;
    setIntervalSpy = jest.spyOn(global, 'setInterval').mockReturnValue(pollTimer);
    configService.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'TELEGRAM_RUNTIME_CONFIG_POLL_INTERVAL_MS') {
        return 30000;
      }

      return fallback as never;
    });
    configService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'API_INTERNAL_BASE_URL') {
        return 'http://127.0.0.1:3000';
      }

      if (key === 'TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN') {
        return 'internal-token';
      }

      throw new Error(`Unexpected config key ${key}`);
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    setIntervalSpy.mockRestore();
  });

  it('loads the active runtime config from the API on bootstrap', async () => {
    fetchMock.mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        data: {
          chatId: '-100123',
          token: 'token-one',
          version: 1,
        },
      }),
      ok: true,
      text: jest.fn().mockResolvedValue('ok'),
    });

    const service = new TelegramRuntimeConfigService(configService);

    await service.onModuleInit();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/v1/internal/integrations/telegram/runtime-config',
      {
        headers: {
          'x-internal-token': 'internal-token',
        },
        method: 'GET',
      },
    );
    expect(service.getActiveConfigOrThrow()).toEqual({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
  });

  it('keeps the previous config when a refresh fails after bootstrap', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          data: {
            chatId: '-100123',
            token: 'token-one',
            version: 1,
          },
        }),
        ok: true,
        text: jest.fn().mockResolvedValue('ok'),
      })
      .mockResolvedValueOnce({
        ok: false,
        text: jest.fn().mockResolvedValue('boom'),
      });

    const service = new TelegramRuntimeConfigService(configService);

    await service.onModuleInit();
    await expect(service.refreshActiveConfig('signal')).rejects.toThrow(
      'Failed to load Telegram runtime config',
    );

    expect(service.getActiveConfigOrThrow()).toEqual({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
  });

  it('boots without crashing and keeps polling when the first runtime config load fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('boom'),
    });

    const service = new TelegramRuntimeConfigService(configService);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    expect(pollTimer.unref).toHaveBeenCalledTimes(1);
    expect(() => service.getActiveConfigOrThrow()).toThrow(
      TelegramRuntimeConfigUnavailableError,
    );
    expect(service.getStatus()).toEqual({
      hasUsableConfig: false,
      lastErrorMessage: expect.stringContaining(
        'Failed to load Telegram runtime config: 500 boom',
      ),
      lastRefreshAttemptAt: expect.any(Date),
      lastRefreshSucceededAt: null,
      version: null,
    });
  });

  it('swaps to the newer config version when refresh succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          data: {
            chatId: '-100123',
            token: 'token-one',
            version: 1,
          },
        }),
        ok: true,
        text: jest.fn().mockResolvedValue('ok'),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          data: {
            chatId: '-100456',
            token: 'token-two',
            version: 2,
          },
        }),
        ok: true,
        text: jest.fn().mockResolvedValue('ok'),
      });

    const service = new TelegramRuntimeConfigService(configService);

    await service.onModuleInit();
    await service.refreshActiveConfig('signal');

    expect(service.getActiveConfigOrThrow()).toEqual({
      chatId: '-100456',
      token: 'token-two',
      version: 2,
    });
  });

  it('tracks successful refresh status after recovering from an initial failure', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('boom'),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          data: {
            chatId: '-100456',
            token: 'token-two',
            version: 2,
          },
        }),
        ok: true,
        text: jest.fn().mockResolvedValue('ok'),
      });

    const service = new TelegramRuntimeConfigService(configService);

    await service.onModuleInit();
    await service.refreshActiveConfig('signal');

    expect(service.getStatus()).toEqual({
      hasUsableConfig: true,
      lastErrorMessage: null,
      lastRefreshAttemptAt: expect.any(Date),
      lastRefreshSucceededAt: expect.any(Date),
      version: 2,
    });
  });
});
