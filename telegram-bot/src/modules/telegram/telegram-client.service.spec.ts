import { GrammyError, HttpError } from 'grammy';
import { TelegramClientService } from './telegram-client.service';
import type { TelegramApiClientFactory } from './telegram-api-client.factory';
import {
  TelegramRuntimeConfigUnavailableError,
  type TelegramRuntimeConfigService,
} from './telegram-runtime-config.service';

describe('TelegramClientService', () => {
  const apiClientFactory: jest.Mocked<TelegramApiClientFactory> = {
    getClient: jest.fn(),
  } as unknown as jest.Mocked<TelegramApiClientFactory>;
  const runtimeConfigService: jest.Mocked<TelegramRuntimeConfigService> = {
    getActiveConfigOrThrow: jest.fn(),
  } as unknown as jest.Mocked<TelegramRuntimeConfigService>;
  const apiClientOne = {
    sendMessage: jest.fn(),
  };
  const apiClientTwo = {
    sendMessage: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    apiClientOne.sendMessage.mockResolvedValue({
      chat: { id: -100123 },
    });
    apiClientTwo.sendMessage.mockResolvedValue({
      chat: { id: -100456 },
    });
  });

  it('reads the active runtime config on each send', async () => {
    runtimeConfigService.getActiveConfigOrThrow
      .mockReturnValueOnce({
        chatId: '-100123',
        token: 'token-one',
        version: 1,
      })
      .mockReturnValueOnce({
        chatId: '-100456',
        token: 'token-two',
        version: 2,
      });
    apiClientFactory.getClient
      .mockReturnValueOnce(apiClientOne)
      .mockReturnValueOnce(apiClientTwo);

    const service = new TelegramClientService(
      runtimeConfigService,
      apiClientFactory,
    );

    await service.sendMessage('first');
    await service.sendMessage('second');

    expect(apiClientFactory.getClient).toHaveBeenNthCalledWith(
      1,
      {
        chatId: '-100123',
        token: 'token-one',
        version: 1,
      },
    );
    expect(apiClientOne.sendMessage).toHaveBeenNthCalledWith(
      1,
      '-100123',
      'first',
      undefined,
    );
    expect(apiClientFactory.getClient).toHaveBeenNthCalledWith(
      2,
      {
        chatId: '-100456',
        token: 'token-two',
        version: 2,
      },
    );
    expect(apiClientTwo.sendMessage).toHaveBeenNthCalledWith(
      1,
      '-100456',
      'second',
      undefined,
    );
  });

  it('passes optional parse mode through to the telegram api client', async () => {
    runtimeConfigService.getActiveConfigOrThrow.mockReturnValue({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
    apiClientFactory.getClient.mockReturnValue(apiClientOne);

    const service = new TelegramClientService(
      runtimeConfigService,
      apiClientFactory,
    );

    await service.sendMessage('<b>hello</b>', { parseMode: 'HTML' });

    expect(apiClientOne.sendMessage).toHaveBeenCalledWith(
      '-100123',
      '<b>hello</b>',
      { parse_mode: 'HTML' },
    );
  });

  it('normalizes grammY api errors', async () => {
    runtimeConfigService.getActiveConfigOrThrow.mockReturnValue({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
    apiClientFactory.getClient.mockReturnValue(apiClientOne);
    apiClientOne.sendMessage.mockRejectedValue(
      new GrammyError(
        'telegram rejected the request',
        {
          ok: false,
          error_code: 400,
          description: 'Bad Request: chat not found',
          parameters: {},
        },
        'sendMessage',
        {
          chat_id: '-100123',
          text: 'hello',
        },
      ),
    );

    const service = new TelegramClientService(
      runtimeConfigService,
      apiClientFactory,
    );

    await expect(service.sendMessage('hello')).rejects.toThrow(
      'Telegram sendMessage failed: 400 Bad Request: chat not found',
    );
  });

  it('normalizes grammY http errors', async () => {
    runtimeConfigService.getActiveConfigOrThrow.mockReturnValue({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
    apiClientFactory.getClient.mockReturnValue(apiClientOne);
    apiClientOne.sendMessage.mockRejectedValue(
      new HttpError('Network request for sendMessage failed', new Error('boom')),
    );

    const service = new TelegramClientService(
      runtimeConfigService,
      apiClientFactory,
    );

    await expect(service.sendMessage('hello')).rejects.toThrow(
      'Telegram sendMessage failed: Network request for sendMessage failed',
    );
  });

  it('propagates runtime config unavailable errors without normalizing them', async () => {
    runtimeConfigService.getActiveConfigOrThrow.mockImplementation(() => {
      throw new TelegramRuntimeConfigUnavailableError(
        'Telegram runtime config is unavailable.',
      );
    });

    const service = new TelegramClientService(
      runtimeConfigService,
      apiClientFactory,
    );

    await expect(service.sendMessage('hello')).rejects.toBeInstanceOf(
      TelegramRuntimeConfigUnavailableError,
    );
    expect(apiClientFactory.getClient).not.toHaveBeenCalled();
  });
});
