import { UnauthorizedException } from '@nestjs/common';
import { AuthSessionTokensService } from './auth-session-tokens.service';

describe('AuthSessionTokensService', () => {
  const service = new AuthSessionTokensService();

  it('rejects malformed refresh tokens', () => {
    expect(() => service.parseRefreshToken('invalid')).toThrow(
      UnauthorizedException,
    );
  });

  it('hashes opaque tokens deterministically', () => {
    expect(service.hashOpaqueToken('secret-token')).toBe(
      service.hashOpaqueToken('secret-token'),
    );
  });
});
