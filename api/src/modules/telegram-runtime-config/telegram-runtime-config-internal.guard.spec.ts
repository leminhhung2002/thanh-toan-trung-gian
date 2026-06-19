import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { TelegramRuntimeConfigInternalGuard } from './telegram-runtime-config-internal.guard';

function createContext(token?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token ? { 'x-internal-token': token } : {},
      }),
    }),
  };
}

describe('TelegramRuntimeConfigInternalGuard', () => {
  const configService = {
    getOrThrow: jest.fn(),
  } as unknown as jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.resetAllMocks();
    configService.getOrThrow.mockReturnValue('shared-secret');
  });

  it('allows requests with the expected internal token header', () => {
    const guard = new TelegramRuntimeConfigInternalGuard(configService);

    expect(guard.canActivate(createContext('shared-secret') as never)).toBe(true);
  });

  it('rejects requests with a missing token header', () => {
    const guard = new TelegramRuntimeConfigInternalGuard(configService);

    expect(() => guard.canActivate(createContext() as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests with an invalid token header', () => {
    const guard = new TelegramRuntimeConfigInternalGuard(configService);

    expect(() => guard.canActivate(createContext('wrong-token') as never)).toThrow(
      UnauthorizedException,
    );
  });
});
