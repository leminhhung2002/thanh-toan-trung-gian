import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramRuntimeConfigInternalGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | undefined>;
    }>();
    const receivedToken = request.headers?.['x-internal-token']?.trim();
    const expectedToken = this.configService.getOrThrow<string>(
      'TELEGRAM_RUNTIME_CONFIG_INTERNAL_TOKEN',
    );

    if (!receivedToken || receivedToken !== expectedToken) {
      throw new UnauthorizedException({
        code: 'internal_auth_invalid',
        message: 'Internal runtime config token is invalid.',
      });
    }

    return true;
  }
}
