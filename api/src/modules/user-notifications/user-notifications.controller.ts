import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { UserNotificationsService } from './user-notifications.service';

function parseLimit(value?: string) {
  if (!value) {
    return 50;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BadRequestException({
      code: 'invalid_notification_limit',
      message: 'Giới hạn thông báo phải là số nguyên dương.',
    });
  }

  return parsed;
}

@Controller('notifications')
@UseGuards(AccessTokenGuard)
export class UserNotificationsController {
  constructor(
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    return {
      data: await this.userNotificationsService.listForUser(
        user.sub,
        parseLimit(limit),
      ),
    };
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.userNotificationsService.getUnreadCount(user.sub),
    };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.CREATED)
  async readAll(@CurrentUser() user: JwtPayload) {
    return {
      data: await this.userNotificationsService.markAllRead(user.sub),
    };
  }
}
