import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccessTokenGuard } from '../../platform/auth/access-token.guard';
import { CurrentUser } from '../../platform/auth/current-user.decorator';
import type { JwtPayload } from '../../platform/auth/jwt-payload.type';
import { Roles } from '../../platform/auth/roles.decorator';
import { RolesGuard } from '../../platform/auth/roles.guard';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN } from '../iam/role.constants';
import { ReorderHomepageBannersDto } from './dto/reorder-homepage-banners.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { SettingsService } from './settings.service';
import type { Response } from 'express';

@Controller('admin/settings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return {
      data: await this.settingsService.getAdminSettings(),
    };
  }

  @Patch()
  async updateSettings(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAdminSettingsDto,
  ) {
    return {
      data: await this.settingsService.updateAdminSettings(user.sub, dto),
    };
  }

  @Post('banners')
  @UseInterceptors(FileInterceptor('image'))
  async uploadHomepageBanner(
    @CurrentUser() user: JwtPayload,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname?: string;
      size: number;
    },
  ) {
    return {
      data: await this.settingsService.uploadHomepageBanner(user.sub, file),
    };
  }

  @Patch('banners/order')
  async reorderHomepageBanners(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReorderHomepageBannersDto,
  ) {
    return {
      data: await this.settingsService.reorderHomepageBanners(
        user.sub,
        dto.bannerIds,
      ),
    };
  }

  @Delete('banners/:bannerId')
  async deleteHomepageBanner(
    @CurrentUser() user: JwtPayload,
    @Param('bannerId') bannerId: string,
  ) {
    return {
      data: await this.settingsService.deleteHomepageBanner(user.sub, bannerId),
    };
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('financial')
  @UseGuards(AccessTokenGuard)
  async getFinancialSettings() {
    return {
      data: await this.settingsService.getFinancialSettings(),
    };
  }

  @Get('display')
  async getDisplaySettings() {
    return {
      data: await this.settingsService.getDisplaySettings(),
    };
  }
}

@Controller('public/homepage-banners')
export class HomepageBannersController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get(':filename')
  async getHomepageBanner(
    @Param('filename') filename: string,
    @Res() response: Response,
  ) {
    const filePath = await this.settingsService.getHomepageBannerFilePath(
      filename,
    );
    response.sendFile(filePath);
  }
}
