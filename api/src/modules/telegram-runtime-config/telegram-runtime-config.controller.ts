import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { Roles } from '../../platform/auth/roles.decorator';
import { RolesGuard } from '../../platform/auth/roles.guard';
import { ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { UpdateTelegramRuntimeConfigDto } from './dto/update-telegram-runtime-config.dto';
import { TelegramRuntimeConfigInternalGuard } from './telegram-runtime-config-internal.guard';
import { TelegramRuntimeConfigService } from './telegram-runtime-config.service';

@Controller('admin/integrations/telegram')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_SUPER_ADMIN)
export class AdminTelegramRuntimeConfigController {
  constructor(
    private readonly telegramRuntimeConfigService: TelegramRuntimeConfigService,
  ) {}

  @Get()
  async getSummary() {
    return {
      data: await this.telegramRuntimeConfigService.getAdminSummary(),
    };
  }

  @Patch()
  async update(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTelegramRuntimeConfigDto,
  ) {
    return {
      data: await this.telegramRuntimeConfigService.updateActive(user.sub, dto),
    };
  }
}

@Controller('internal/integrations/telegram')
@UseGuards(TelegramRuntimeConfigInternalGuard)
export class InternalTelegramRuntimeConfigController {
  constructor(
    private readonly telegramRuntimeConfigService: TelegramRuntimeConfigService,
  ) {}

  @Get('runtime-config')
  async getRuntimeConfig() {
    return {
      data: await this.telegramRuntimeConfigService.getInternalRuntimeConfig(),
    };
  }
}
