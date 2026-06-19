import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';

@Injectable()
export class AuthSessionTokensService {
  parseRefreshToken(refreshToken: string) {
    const [sessionId, secret] = refreshToken.split('.');
    if (!sessionId || !secret) {
      throw new UnauthorizedException({
        code: 'refresh_token_invalid',
        message: 'Phiên đăng nhập không còn hợp lệ.',
      });
    }

    return { secret, sessionId };
  }

  generateOpaqueToken() {
    return randomBytes(32).toString('hex');
  }

  hashOpaqueToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
