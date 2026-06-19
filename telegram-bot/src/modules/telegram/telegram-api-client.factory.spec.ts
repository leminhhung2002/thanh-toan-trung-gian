import { TelegramApiClientFactory } from './telegram-api-client.factory';

describe('TelegramApiClientFactory', () => {
  it('reuses the cached api client when token and version are unchanged', () => {
    const buildClient = jest.fn((token: string) => ({
      sendMessage: jest.fn().mockResolvedValue({ token }),
    }));
    const factory = new TelegramApiClientFactory(buildClient);

    const config = {
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    };

    const first = factory.getClient(config);
    const second = factory.getClient(config);

    expect(buildClient).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('swaps to a new api client when the runtime config version changes', () => {
    const buildClient = jest
      .fn()
      .mockReturnValueOnce({ sendMessage: jest.fn() })
      .mockReturnValueOnce({ sendMessage: jest.fn() });
    const factory = new TelegramApiClientFactory(buildClient);

    const first = factory.getClient({
      chatId: '-100123',
      token: 'token-one',
      version: 1,
    });
    const second = factory.getClient({
      chatId: '-100456',
      token: 'token-one',
      version: 2,
    });

    expect(buildClient).toHaveBeenCalledTimes(2);
    expect(first).not.toBe(second);
  });
});
